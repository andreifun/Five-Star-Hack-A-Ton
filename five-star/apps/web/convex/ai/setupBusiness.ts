"use node";

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { getAiGateway, getApifyApiKey } from "./env";
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

      const apifyKey = getApifyApiKey();

      // Resolve short URLs (maps.app.goo.gl) before passing to Apify
      let resolvedUrl = sl.google;
      if (sl.google.includes("maps.app.goo.gl")) {
        const r = await fetch(sl.google, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
        resolvedUrl = r.url;
      }

      // Start the Apify Google Maps Scraper actor run
      const runResp = await fetch(
        `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${apifyKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: resolvedUrl }],
            maxReviews: 200,
            reviewsSort: "newest",
            language: "en",
            scrapeReviews: true,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!runResp.ok) {
        throw new Error(`[fetch_google] Apify actor start failed: ${runResp.status}`);
      }

      const runData = (await runResp.json()) as {
        data?: { id?: string; defaultDatasetId?: string; status?: string };
      };
      const runId = runData.data?.id;
      const datasetId = runData.data?.defaultDatasetId;
      if (!runId || !datasetId) {
        throw new Error("[fetch_google] Apify run response missing id or datasetId");
      }

      // Poll until the run finishes (max 8 minutes)
      const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);
      const deadline = Date.now() + 8 * 60 * 1000;
      let status = runData.data?.status ?? "";
      while (!TERMINAL.has(status) && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 5000));
        try {
          const statusResp = await fetch(
            `https://api.apify.com/v2/acts/compass~crawler-google-places/runs/${runId}?token=${apifyKey}`,
            { signal: AbortSignal.timeout(10000) },
          );
          if (statusResp.ok) {
            const statusData = (await statusResp.json()) as { data?: { status?: string } };
            status = statusData.data?.status ?? status;
          }
        } catch {
          // transient poll failure — keep waiting
        }
      }

      if (status !== "SUCCEEDED") {
        throw new Error(`[fetch_google] Apify actor run ended with status: ${status}`);
      }

      // Fetch dataset items (the actor returns one item per place URL)
      const dataResp = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyKey}&format=json`,
        { signal: AbortSignal.timeout(30000) },
      );
      if (!dataResp.ok) {
        throw new Error(`[fetch_google] Failed to fetch Apify dataset: ${dataResp.status}`);
      }

      const items = (await dataResp.json()) as Array<{
        website?: string;
        address?: string;
        phone?: string;
        reviews?: Array<{
          reviewId?: string;
          name?: string;
          stars?: number;
          text?: string;
          publishedAtDate?: string;
        }>;
      }>;

      const place = items[0];
      if (!place) break;

      // Update business metadata from the scraped place
      const patch: Record<string, string> = {};
      if (place.website) patch.mapsWebsite = place.website;
      if (place.address && !business.address) patch.address = place.address;
      if (place.phone && !business.phone) patch.phone = place.phone;
      if (Object.keys(patch).length > 0) {
        await ctx.runMutation(internal.businesses.updateInternal, {
          businessId: business._id,
          ...patch,
        });
      }

      const allReviews = (place.reviews ?? []).map((r) => ({
        rating: Math.max(1, Math.min(5, Math.round(r.stars ?? 3))),
        reviewerName: r.name ?? undefined,
        text: r.text ?? undefined,
        reviewDate: r.publishedAtDate ? new Date(r.publishedAtDate).getTime() : Date.now(),
        externalId: r.reviewId ?? "",
      }));

      await ctx.runMutation(internal.reviews.bulkImportInternal, {
        businessId: business._id,
        reviews: allReviews.map((r) => ({
          ...r,
          externalId: r.externalId || contentFingerprint("google", r),
          source: "google" as const,
          isPublic: true as const,
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
