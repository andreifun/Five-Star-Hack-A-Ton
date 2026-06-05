"use node";

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";

const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const MODEL_ID = "minimax/m3";

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
          place_info?: { address?: string; phone?: string };
        };

        // Extract profile info from first page
        if (isFirstPage && data.place_info) {
          const patch: Record<string, string> = {};
          if (data.place_info.address && !business.address) patch.address = data.place_info.address;
          if (data.place_info.phone && !business.phone) patch.phone = data.place_info.phone;
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
        reviews: allReviews.map((r) => ({ ...r, source: "google" as const, isPublic: true as const })),
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

        const importReviews = reviews.map((r) => ({
          rating: Math.max(1, Math.min(5, Math.round(r.rating ?? 3))),
          reviewerName: r.reviewerName,
          text: r.text,
          title: r.title,
          reviewDate: r.reviewDate ? new Date(r.reviewDate).getTime() : Date.now(),
          source,
          isPublic: true as const,
        }));

        await ctx.runMutation(internal.reviews.bulkImportInternal, {
          businessId: business._id,
          reviews: importReviews,
        });
      } catch {
        // Unparseable — skip quietly
      }
      break;
    }

    case "discover_products": {
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
        if (!Array.isArray(products)) return;
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
