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
          place_info?: { address?: string; phone?: string; website?: string };
        };

        // Extract profile info from first page
        if (isFirstPage && data.place_info) {
          const patch: Record<string, string> = {};
          if (data.place_info.address && !business.address) patch.address = data.place_info.address;
          if (data.place_info.phone && !business.phone) patch.phone = data.place_info.phone;
          if (data.place_info.website && !business.website) patch.website = data.place_info.website;
          if (Object.keys(patch).length > 0) {
            await ctx.runMutation(internal.businesses.updateInternal, {
              businessId: business._id,
              ...patch,
            });
          }
        }

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

      // Restaurants: scrape real menu items from available sources.
      type MenuItem = { name: string; description?: string; category?: string; price?: number };

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

      async function findMenuUrl(html: string, baseUrl: string): Promise<string | null> {
        if (!html) return null;
        const { text: raw } = await generateText({
          model: gateway(MODEL_ID),
          prompt: `Given the following HTML from the restaurant website at ${baseUrl}, is there a link to a separate menu page? If yes, output only the full URL (absolute or relative). If no, output the word "none". HTML:
${html.slice(0, 10000)}`,
          maxOutputTokens: 128,
        });
        const trimmed = raw.trim();
        if (!trimmed || trimmed.toLowerCase() === "none") return null;
        // Resolve relative URLs
        try {
          return new URL(trimmed, baseUrl).href;
        } catch {
          return null;
        }
      }

      let menuItems: MenuItem[] = [];

      // Source A: business website (authoritative URL from Google Maps place_info)
      if (menuItems.length === 0 && business.website) {
        const html = await safelyFetchUrl(business.website);
        if (html) {
          const items = await extractMenuFromHtml(html);
          if (items.length > 0) {
            menuItems = items;
          } else {
            // Try to find a linked menu sub-page
            const menuUrl = await findMenuUrl(html, business.website);
            if (menuUrl) {
              const menuHtml = await safelyFetchUrl(menuUrl);
              const subItems = await extractMenuFromHtml(menuHtml);
              if (subItems.length > 0) menuItems = subItems;
            }
          }
        }
      }

      // Source B: linked restaurant-directory sites that may carry menus
      if (menuItems.length === 0) {
        const directoryDomains = ["restaurantguru", "zomato", "thefork", "happycow", "yelp"];
        for (const link of (Object.values(business.socialLinks ?? {}) as (string | undefined)[])) {
          if (!link) continue;
          const inDirectory = directoryDomains.some((d) => (link as string).includes(d));
          if (!inDirectory) continue;
          const html = await safelyFetchUrl(link as string);
          const items = await extractMenuFromHtml(html);
          if (items.length > 0) {
            menuItems = items;
            break;
          }
        }
      }

      // Source C: SerpAPI web search for the restaurant's menu
      if (menuItems.length === 0) {
        const serpApiKey = process.env.SERPAPI_API_KEY;
        if (serpApiKey) {
          const params = new URLSearchParams({
            engine: "google",
            q: `"${business.name}" menu`,
            num: "3",
            api_key: serpApiKey,
          });
          try {
            const resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
              signal: AbortSignal.timeout(15000),
            });
            if (resp.ok) {
              const data = (await resp.json()) as {
                organic_results?: Array<{ link?: string }>;
              };
              for (const result of data.organic_results ?? []) {
                if (!result.link) continue;
                const html = await safelyFetchUrl(result.link);
                const items = await extractMenuFromHtml(html);
                if (items.length > 0) {
                  menuItems = items;
                  break;
                }
              }
            }
          } catch {
            // Search failed — continue
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
