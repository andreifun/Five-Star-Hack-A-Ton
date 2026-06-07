"use node";

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { getAiGateway, getSerpApiKey } from "./env";
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

const getGateway = getAiGateway;

const MODEL_ID = "minimax/minimax-m3";

async function safelyFetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
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
        model: getGateway()(MODEL_ID),
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
        model: getGateway()(MODEL_ID),
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

      const serpApiKey = getSerpApiKey();
      if (!serpApiKey) throw new Error("SERPAPI_API_KEY is not configured");

      // Resolve short URLs (maps.app.goo.gl) to the full URL to extract the data_id
      let resolvedUrl = sl.google;
      if (sl.google.includes("maps.app.goo.gl")) {
        const r = await fetch(sl.google, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
        resolvedUrl = r.url;
      }

      let dataId: string;
      const dataIdMatch = resolvedUrl.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
      if (dataIdMatch) {
        dataId = dataIdMatch[1]!;
      } else {
        const cidMatch = resolvedUrl.match(/[?&]cid=(\d+)/);
        if (!cidMatch) {
          throw new Error(`Could not extract Google Maps place ID from URL: ${sl.google}`);
        }
        dataId = `0x0:0x${BigInt(cidMatch[1]!).toString(16)}`;
      }

      // Fetch place details (website, address, phone) from the google_maps engine.
      let mapsWebsiteSet = false;
      try {
        const placeParams = new URLSearchParams({
          engine: "google_maps",
          type: "place",
          // data parameter format required for place lookups
          data: `!4m2!3m1!1s${dataId}`,
          api_key: serpApiKey,
        });
        const placeResp = await fetch(`https://serpapi.com/search.json?${placeParams.toString()}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (placeResp.ok) {
          const placeData = (await placeResp.json()) as {
            place_results?: {
              website?: string;
              address?: string;
              phone?: string;
              links?: { website?: string };
            };
          };
          const pr = placeData.place_results;
          const website = pr?.website ?? pr?.links?.website;
          const patch: Record<string, string> = {};
          if (website) { patch.mapsWebsite = website; mapsWebsiteSet = true; }
          if (pr?.address && !business.address) patch.address = pr.address;
          if (pr?.phone && !business.phone) patch.phone = pr.phone;
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
          place_info?: { address?: string; phone?: string; website?: string };
        };

        // Fallback: if the place details call above didn't set mapsWebsite, try place_info here
        if (isFirstPage && data.place_info && !mapsWebsiteSet) {
          const fallbackPatch: Record<string, string> = {};
          if (data.place_info.website) fallbackPatch.mapsWebsite = data.place_info.website;
          if (data.place_info.address && !business.address) fallbackPatch.address = data.place_info.address;
          if (data.place_info.phone && !business.phone) fallbackPatch.phone = data.place_info.phone;
          if (Object.keys(fallbackPatch).length > 0) {
            await ctx.runMutation(internal.businesses.updateInternal, {
              businessId: business._id,
              ...fallbackPatch,
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
    case "fetch_yelp": {
      const urlMap = {
        fetch_tripadvisor: sl.tripadvisor,
        fetch_yelp: sl.yelp,
      } as Record<string, string | undefined>;
      const sourceMap = {
        fetch_tripadvisor: "tripadvisor",
        fetch_yelp: "yelp",
      } as Record<string, "tripadvisor" | "yelp">;

      const url = urlMap[task.type];
      const source = sourceMap[task.type] as "tripadvisor" | "yelp";
      if (!url || !source) return;

      const html = await safelyFetchUrl(url);
      if (!html) return;

      const { text } = await generateText({
        model: getGateway()(MODEL_ID),
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
