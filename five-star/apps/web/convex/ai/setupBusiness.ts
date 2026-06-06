"use node";

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { createHash } from "crypto";

function contentFingerprint(
  source: string,
  r: { reviewerName?: string; reviewDate: number; rating: number; text?: string; title?: string },
): string {
  return createHash("sha1")
    .update(`${source}|${r.reviewerName ?? ""}|${r.reviewDate}|${r.rating}|${r.text ?? ""}|${r.title ?? ""}`)
    .digest("hex")
    .slice(0, 20);
}

const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const MODEL_ID = "minimax/minimax-m3";

async function safelyFetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; five-star-bot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    // Truncate to ~20KB to stay within model context limits
    return text.slice(0, 20000);
  } catch {
    return "";
  }
}

export const run = internalAction({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args: { businessId: Id<"businesses"> }) => {
    const business = (await ctx.runQuery(internal.businesses.getByIdInternal, {
      businessId: args.businessId,
    })) as (Doc<"businesses"> & { metrics: Doc<"businessMetrics"> | null }) | null;

    if (!business) return;

    const sl = business.socialLinks ?? {};

    const existingTasks = (await ctx.runQuery(internal.setupTasks.listByBusinessInternal, {
      businessId: args.businessId,
    })) as Doc<"setupTasks">[];

    if (existingTasks.length === 0) {
      await ctx.runMutation(internal.setupTasks.createForBusiness, {
        businessId: args.businessId,
        hasLocation: !!business.location,
        hasWebsite: !!business.website,
        hasGoogle: !!sl.google,
        hasTripadvisor: !!sl.tripadvisor,
        hasBooking: !!sl.booking,
        hasYelp: !!sl.yelp,
      });
    }

    const tasks = existingTasks.length > 0
      ? existingTasks
      : (await ctx.runQuery(internal.setupTasks.listByBusinessInternal, {
          businessId: args.businessId,
        })) as Doc<"setupTasks">[];

    for (const task of tasks) {
      if (task.status === "skipped") continue;

      await ctx.runMutation(internal.setupTasks.updateStatus, {
        taskId: task._id,
        status: "running",
      });

      try {
        await runTask(ctx, task, business);
        await ctx.runMutation(internal.setupTasks.updateStatus, {
          taskId: task._id,
          status: "completed",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await ctx.runMutation(internal.setupTasks.updateStatus, {
          taskId: task._id,
          status: "failed",
          message,
        });
      }
    }
  },
});

async function runTask(
  ctx: ActionCtx,
  task: Doc<"setupTasks">,
  business: Doc<"businesses"> & { metrics: Doc<"businessMetrics"> | null },
): Promise<void> {
  const sl = business.socialLinks ?? {};

  switch (task.type) {
    case "classify_location": {
      if (!business.location) return;
      const { text } = await generateText({
        model: gateway(MODEL_ID),
        prompt: `Is the following location rural or urban? Reply with exactly one word: "rural" or "urban". Location: ${business.location}`,
        maxOutputTokens: 10,
      });
      const locationType = text.trim().toLowerCase().startsWith("rural") ? "rural" : "urban";
      await ctx.runMutation(internal.businesses.updateInternal, {
        businessId: business._id,
        locationType,
      });
      break;
    }

    case "fetch_website": {
      if (!business.website) return;
      const html = await safelyFetchUrl(business.website);
      if (!html) return;
      const { text } = await generateText({
        model: gateway(MODEL_ID),
        prompt: `Extract from this business website HTML the following fields in JSON: description (string), openingHours (string), phone (string), address (string), city (string), country (string). Only output valid JSON, no markdown.

HTML:
${html.slice(0, 15000)}`,
        maxOutputTokens: 512,
      });
      try {
        const parsed = JSON.parse(text);
        const patch: Record<string, string> = {};
        if (parsed.description && !business.description) patch.description = parsed.description;
        if (parsed.openingHours && !business.openingHours) patch.openingHours = parsed.openingHours;
        if (parsed.phone && !business.phone) patch.phone = parsed.phone;
        if (parsed.address && !business.address) patch.address = parsed.address;
        if (parsed.city && !business.city) patch.city = parsed.city;
        if (parsed.country && !business.country) patch.country = parsed.country;
        if (Object.keys(patch).length > 0) {
          await ctx.runMutation(internal.businesses.updateInternal, {
            businessId: business._id,
            ...patch,
          });
        }
      } catch {
        // Unparseable — skip quietly
      }
      break;
    }

    case "fetch_google": {
      if (!sl.google) return;

      const serpApiKey = process.env.SERPAPI_API_KEY;
      if (!serpApiKey) throw new Error("SERPAPI_API_KEY is not configured");

      // Resolve short URLs (maps.app.goo.gl) to the full URL to extract the data_id
      let resolvedUrl = sl.google;
      if (sl.google.includes("maps.app.goo.gl")) {
        const r = await fetch(sl.google, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
        resolvedUrl = r.url;
      }

      const dataIdMatch = resolvedUrl.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
      if (!dataIdMatch) {
        throw new Error(`Could not extract Google Maps place ID from URL: ${sl.google}`);
      }
      const dataId = dataIdMatch[1]!;

      // Fetch place details (website, address, phone) from the google_maps engine.
      // This is more reliable than place_info from the reviews engine.
      try {
        const placeParams = new URLSearchParams({
          engine: "google_maps",
          data_id: dataId,
          api_key: serpApiKey,
        });
        const placeResp = await fetch(`https://serpapi.com/search.json?${placeParams.toString()}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (placeResp.ok) {
          const placeData = (await placeResp.json()) as {
            place_results?: { website?: string; address?: string; phone?: string };
          };
          const patch: Record<string, string> = {};
          if (placeData.place_results?.website) patch.mapsWebsite = placeData.place_results.website;
          if (placeData.place_results?.address && !business.address) patch.address = placeData.place_results.address;
          if (placeData.place_results?.phone && !business.phone) patch.phone = placeData.place_results.phone;
          if (Object.keys(patch).length > 0) {
            await ctx.runMutation(internal.businesses.updateInternal, {
              businessId: business._id,
              ...patch,
            });
          }
        }
      } catch {
        // Place details failed — continue to reviews
      }

      const allReviews: Array<{
        rating: number;
        reviewerName?: string;
        text?: string;
        reviewDate: number;
      }> = [];

      let nextPageToken: string | undefined;
      let isFirstPage = true;
      do {
        const params = new URLSearchParams({
          engine: "google_maps_reviews",
          data_id: dataId,
          api_key: serpApiKey,
          hl: "en",
        });
        if (nextPageToken) params.set("next_page_token", nextPageToken);

        const resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`SerpAPI error: ${resp.status} ${body}`);
        }

        const data = (await resp.json()) as {
          reviews?: Array<{
            rating?: number;
            snippet?: string;
            user?: { name?: string };
            iso_date?: string;
          }>;
          serpapi_pagination?: { next_page_token?: string };
        };

        if (isFirstPage && (!data.reviews || data.reviews.length === 0)) {
          throw new Error("No reviews found for this location");
        }

        for (const r of data.reviews ?? []) {
          allReviews.push({
            rating: Math.max(1, Math.min(5, Math.round(r.rating ?? 3))),
            reviewerName: r.user?.name,
            text: r.snippet,
            reviewDate: r.iso_date ? new Date(r.iso_date).getTime() : Date.now(),
          });
        }

        nextPageToken = data.serpapi_pagination?.next_page_token;
        isFirstPage = false;
      } while (nextPageToken);

      await ctx.runMutation(internal.reviews.bulkImportInternal, {
        businessId: business._id,
        reviews: allReviews.map((r) => ({
          ...r,
          source: "google" as const,
          isPublic: true as const,
          externalId: contentFingerprint("google", r),
        })),
      });
      await ctx.runMutation(internal.reviews.deduplicateExisting, {
        businessId: business._id,
      });
      break;
    }

    case "fetch_tripadvisor":
    case "fetch_booking":
    case "fetch_yelp": {
      const urlMap = {
        fetch_tripadvisor: sl.tripadvisor,
        fetch_booking: sl.booking,
        fetch_yelp: sl.yelp,
      } as Record<string, string | undefined>;
      const sourceMap = {
        fetch_tripadvisor: "tripadvisor",
        fetch_booking: "booking",
        fetch_yelp: "yelp",
      } as Record<string, "tripadvisor" | "booking" | "yelp">;

      const url = urlMap[task.type];
      const source = sourceMap[task.type] as "tripadvisor" | "booking" | "yelp";
      if (!url || !source) return;

      const html = await safelyFetchUrl(url);
      if (!html) return;

      const { text } = await generateText({
        model: gateway(MODEL_ID),
        prompt: `Extract up to 20 customer reviews from this HTML. Output a JSON array with objects: { rating: number (1-5), reviewerName: string, text: string, title?: string, reviewDate: string (ISO date) }. Only output valid JSON array, no markdown.

HTML:
${html.slice(0, 15000)}`,
        maxOutputTokens: 2048,
      });

      try {
        const reviews = JSON.parse(text) as Array<{
          rating: number;
          reviewerName?: string;
          text?: string;
          title?: string;
          reviewDate?: string;
        }>;
        if (!Array.isArray(reviews) || reviews.length === 0) return;

        const importReviews = reviews.map((r) => {
          const base = {
            rating: Math.max(1, Math.min(5, Math.round(r.rating ?? 3))),
            reviewerName: r.reviewerName,
            text: r.text,
            title: r.title,
            reviewDate: r.reviewDate ? new Date(r.reviewDate).getTime() : Date.now(),
            source,
            isPublic: true as const,
          };
          return { ...base, externalId: contentFingerprint(source, base) };
        });

        await ctx.runMutation(internal.reviews.bulkImportInternal, {
          businessId: business._id,
          reviews: importReviews,
        });
        await ctx.runMutation(internal.reviews.deduplicateExisting, {
          businessId: business._id,
        });
      } catch {
        // Unparseable — skip quietly
      }
      break;
    }

    case "discover_products": {
      // Clear existing products so re-runs via "Refresh data" don't accumulate duplicates.
      await ctx.runMutation(internal.products.deleteByBusiness, {
        businessId: business._id,
      });

      // Non-restaurants: keep AI-generated product list.
      if (business.type !== "restaurant") {
        const { text } = await generateText({
          model: gateway(MODEL_ID),
          prompt: `You are helping set up a ${business.type} called "${business.name}".
${business.description ? `Description: ${business.description}` : ""}
${business.cuisineTypes?.length ? `Cuisine: ${business.cuisineTypes.join(", ")}` : ""}

Generate a realistic list of 8-15 products/menu items for this business. Output a JSON array with objects: { name: string, description?: string, category?: string, price?: number, isSignatureDish?: boolean }. Only output valid JSON array, no markdown.`,
          maxOutputTokens: 1024,
        });
        try {
          const products = JSON.parse(text) as Array<{
            name: string;
            description?: string;
            category?: string;
            price?: number;
            isSignatureDish?: boolean;
          }>;
          if (!Array.isArray(products)) break;
          for (const p of products.slice(0, 15)) {
            await ctx.runMutation(internal.products.createInternal, {
              businessId: business._id,
              name: p.name,
              description: p.description,
              category: p.category,
              price: p.price,
              isSignatureDish: p.isSignatureDish ?? false,
              isAvailable: true,
            });
          }
        } catch {
          // Unparseable — skip quietly
        }
        break;
      }

      // Restaurants: scrape real menu items from the Maps-provided website only.
      type MenuItem = { name: string; description?: string; category?: string; price?: number };

      // Re-fetch business to get mapsWebsite set by fetch_google (which ran earlier).
      const freshBusiness = (await ctx.runQuery(internal.businesses.getByIdInternal, {
        businessId: business._id,
      })) as typeof business | null;
      const mapsWebsite = freshBusiness?.mapsWebsite;

      async function extractMenuFromHtml(html: string): Promise<MenuItem[]> {
        if (!html) return [];
        const { text: raw } = await generateText({
          model: gateway(MODEL_ID),
          prompt: `You are a strict data extractor. Look at the HTML below and extract ONLY menu items that are EXPLICITLY listed in the HTML text — dish names, food/drink items, prices, descriptions that are literally present in the page content.

DO NOT invent, guess, or infer any items. DO NOT use your knowledge of what a restaurant might serve. If the page contains no actual menu items in its text, return an empty array [].

Return a JSON array of objects: { name: string, description?: string, category?: string, price?: number }
Only output valid JSON array, no markdown, no explanation.

HTML:
${html.slice(0, 18000)}`,
          maxOutputTokens: 2048,
        });
        try {
          const items = JSON.parse(raw.trim());
          return Array.isArray(items) ? items : [];
        } catch {
          return [];
        }
      }

      async function extractMenuFromImage(imageBytes: Uint8Array): Promise<MenuItem[]> {
        try {
          const { text: raw } = await generateText({
            model: gateway("anthropic/claude-sonnet-4-5"),
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", image: imageBytes },
                  {
                    type: "text",
                    text: `This is a photo of a restaurant menu. Extract all visible menu items you can actually read in the image. Return a JSON array: [{ name: string, description?: string, category?: string, price?: number }]. If you cannot read any menu items, return []. Only output valid JSON array, no markdown.`,
                  },
                ],
              },
            ],
            maxOutputTokens: 2048,
          });
          const items = JSON.parse(raw.trim());
          return Array.isArray(items) ? items : [];
        } catch {
          return [];
        }
      }

      async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!resp.ok) return null;
          const contentType = resp.headers.get("content-type") ?? "";
          if (!contentType.startsWith("image/")) return null;
          const buffer = await resp.arrayBuffer();
          return new Uint8Array(buffer);
        } catch {
          return null;
        }
      }

      function extractMenuImageUrls(html: string, baseUrl: string): string[] {
        const menuKeywords = /menu|carta|food|dish|drink/i;
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const candidates: string[] = [];
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const src = match[1]!;
          const tag = match[0]!;
          // Include if the tag or src mentions menu-related keywords
          if (menuKeywords.test(src) || menuKeywords.test(tag)) {
            try {
              candidates.push(new URL(src, baseUrl).href);
            } catch {
              // skip invalid URLs
            }
          }
        }
        return candidates.slice(0, 5);
      }

      let menuItems: MenuItem[] = [];

      if (!mapsWebsite) {
        // No Maps-provided website — skip straight to sentinel.
      } else {
        // Step 1: fetch the website and look for a dedicated menu page.
        const homeHtml = await safelyFetchUrl(mapsWebsite);

        // Find a /menu sub-page link.
        let menuPageHtml = "";
        if (homeHtml) {
          const { text: menuUrlRaw } = await generateText({
            model: gateway(MODEL_ID),
            prompt: `Given the following HTML from ${mapsWebsite}, find a link to a dedicated menu page. Look for links or paths containing "menu", "carta", "food", "meniu". Output only the full URL, or the word "none" if not found. HTML:
${homeHtml.slice(0, 10000)}`,
            maxOutputTokens: 128,
          });
          const menuUrlTrimmed = menuUrlRaw.trim();
          if (menuUrlTrimmed && menuUrlTrimmed.toLowerCase() !== "none") {
            try {
              const menuUrl = new URL(menuUrlTrimmed, mapsWebsite).href;
              // Only fetch if it's a different page
              if (menuUrl !== mapsWebsite) {
                menuPageHtml = await safelyFetchUrl(menuUrl);
              }
            } catch {
              // Invalid URL — skip
            }
          }
        }

        // Step 2a: text extraction (prefer menu page over home page).
        const htmlToScan = menuPageHtml || homeHtml;
        if (htmlToScan) {
          menuItems = await extractMenuFromHtml(htmlToScan);
          // If menu page had nothing, also try home page
          if (menuItems.length === 0 && menuPageHtml && homeHtml) {
            menuItems = await extractMenuFromHtml(homeHtml);
          }
        }

        // Step 2b: image extraction if text pass found nothing.
        if (menuItems.length === 0 && htmlToScan) {
          const imageUrls = extractMenuImageUrls(htmlToScan, mapsWebsite);
          for (const imgUrl of imageUrls) {
            const imgData = await fetchImageBytes(imgUrl);
            if (!imgData) continue;
            const items = await extractMenuFromImage(imgData);
            if (items.length > 0) {
              menuItems = items;
              break;
            }
          }
        }
      }

      if (menuItems.length > 0) {
        for (const p of menuItems.slice(0, 30)) {
          await ctx.runMutation(internal.products.createInternal, {
            businessId: business._id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            isSignatureDish: false,
            isAvailable: true,
          });
        }
      } else {
        // No real menu found — create sentinel so the UI shows "No items found".
        await ctx.runMutation(internal.products.createInternal, {
          businessId: business._id,
          name: "No items found",
          isSignatureDish: false,
          isAvailable: false,
        });
      }
      break;
    }

    case "generate_tips": {
      await ctx.runAction(internal.ai.generateTips.generateTipsForBusiness, {
        businessId: business._id,
      });
      break;
    }

    case "finalize": {
      await ctx.runMutation(internal.businessMetrics.recompute, {
        businessId: business._id,
      });
      break;
    }
  }
}
