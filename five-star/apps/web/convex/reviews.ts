import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";
import { api, internal } from "./_generated/api";

const sourceValidator = v.union(
  v.literal("google"),
  v.literal("tripadvisor"),
  v.literal("manual"),
  v.literal("booking"),
  v.literal("yelp"),
  v.literal("other"),
);

const sentimentValidator = v.union(
  v.literal("positive"),
  v.literal("neutral"),
  v.literal("negative"),
);

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    source: sourceValidator,
    rating: v.number(),
    title: v.optional(v.string()),
    text: v.optional(v.string()),
    reviewerName: v.optional(v.string()),
    reviewerAvatarUrl: v.optional(v.string()),
    reviewDate: v.number(),
    language: v.optional(v.string()),
    sentiment: v.optional(sentimentValidator),
    sentimentScore: v.optional(v.number()),
    topics: v.optional(v.array(v.string())),
    externalId: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const reviewId = await ctx.db.insert("reviews", { ...args, hasText: !!args.text?.trim() });
    await ctx.scheduler.runAfter(0, internal.businessMetrics.recompute, {
      businessId: args.businessId,
    });
    return reviewId;
  },
});

export const deleteByBusinessAndSource = internalMutation({
  args: {
    businessId: v.id("businesses"),
    source: sourceValidator,
  },
  handler: async (ctx, args): Promise<boolean> => {
    const batch = await ctx.db
      .query("reviews")
      .withIndex("by_businessId_and_source", (q) =>
        q.eq("businessId", args.businessId).eq("source", args.source)
      )
      .take(100);
    for (const r of batch) {
      await ctx.db.delete(r._id);
    }
    return batch.length === 100;
  },
});

export const bulkImportInternal = internalMutation({
  args: {
    businessId: v.id("businesses"),
    reviews: v.array(
      v.object({
        source: sourceValidator,
        rating: v.number(),
        title: v.optional(v.string()),
        text: v.optional(v.string()),
        reviewerName: v.optional(v.string()),
        reviewDate: v.number(),
        isPublic: v.boolean(),
        externalId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const batch = args.reviews.slice(0, 50);
    const remaining = args.reviews.slice(50);

    // Build dedup set from existing reviews for this business
    const existingExternalIds = new Set<string>();
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_businessId_and_externalId", (q) =>
        q.eq("businessId", args.businessId)
      )
      .take(5000);
    for (const r of existing) {
      if (r.externalId) existingExternalIds.add(`${r.source}:${r.externalId}`);
    }

    for (const review of batch) {
      if (review.externalId) {
        const key = `${review.source}:${review.externalId}`;
        if (existingExternalIds.has(key)) continue;
        existingExternalIds.add(key);
      }
      await ctx.db.insert("reviews", {
        businessId: args.businessId,
        ...review,
        hasText: !!review.text?.trim(),
      });
    }

    if (remaining.length > 0) {
      await ctx.scheduler.runAfter(0, internal.reviews.bulkImportInternal, {
        businessId: args.businessId,
        reviews: remaining,
      });
    }

    await ctx.scheduler.runAfter(0, internal.businessMetrics.recompute, {
      businessId: args.businessId,
    });
  },
});

export const deduplicateExisting = internalMutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .take(1000);
    const seen = new Set<string>();
    for (const r of reviews) {
      // Use externalId if present, otherwise derive a key from content fields
      const key = r.externalId
        ? `${r.source}:${r.externalId}`
        : `${r.source}|${r.reviewerName ?? ""}|${r.reviewDate}|${r.rating}|${r.text ?? ""}|${r.title ?? ""}`;
      if (seen.has(key)) {
        await ctx.db.delete(r._id);
      } else {
        seen.add(key);
      }
    }
  },
});

export const bulkImport = mutation({
  args: {
    businessId: v.id("businesses"),
    reviews: v.array(
      v.object({
        source: sourceValidator,
        rating: v.number(),
        title: v.optional(v.string()),
        text: v.optional(v.string()),
        reviewerName: v.optional(v.string()),
        reviewerAvatarUrl: v.optional(v.string()),
        reviewDate: v.number(),
        language: v.optional(v.string()),
        sentiment: v.optional(sentimentValidator),
        sentimentScore: v.optional(v.number()),
        topics: v.optional(v.array(v.string())),
        externalId: v.optional(v.string()),
        isPublic: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);

    const batch = args.reviews.slice(0, 50);
    const remaining = args.reviews.slice(50);

    // Build a set of already-imported external IDs once, rather than querying
    // per review. Keyed by `source:externalId` to scope dedup per source.
    const existingExternalIds = new Set<string>();
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .take(5000);
    for (const r of existing) {
      if (r.externalId) existingExternalIds.add(`${r.source}:${r.externalId}`);
    }

    let imported = 0;
    for (const review of batch) {
      if (review.externalId && review.source !== "manual") {
        const key = `${review.source}:${review.externalId}`;
        if (existingExternalIds.has(key)) continue;
        existingExternalIds.add(key);
      }
      await ctx.db.insert("reviews", {
        businessId: args.businessId,
        ...review,
        hasText: !!review.text?.trim(),
      });
      imported++;
    }

    if (remaining.length > 0) {
      await ctx.scheduler.runAfter(0, api.reviews.bulkImport, {
        businessId: args.businessId,
        reviews: remaining,
      });
    }

    await ctx.scheduler.runAfter(0, internal.businessMetrics.recompute, {
      businessId: args.businessId,
    });

    return { imported };
  },
});

export const update = mutation({
  args: {
    reviewId: v.id("reviews"),
    ownerReply: v.optional(v.string()),
    sentiment: v.optional(sentimentValidator),
    sentimentScore: v.optional(v.number()),
    topics: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { reviewId, ...fields } = args;
    const review = await ctx.db.get(reviewId);
    if (!review) throw new Error("Review not found");
    await requireBusinessOwner(ctx, review.businessId);
    await ctx.db.patch(reviewId, fields);
  },
});

/**
 * Lists recent reviews for a business **without** an ownership check, for use
 * from internal/scheduled actions only (e.g. tip generation, chat context).
 */
export const listRecentInternal = internalQuery({
  args: {
    businessId: v.id("businesses"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_businessId_and_reviewDate", (q) =>
        q.eq("businessId", args.businessId),
      )
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const setReviewPositivityScores = internalMutation({
  args: {
    entries: v.array(v.object({ reviewId: v.id("reviews"), score: v.number() })),
  },
  handler: async (ctx, args) => {
    for (const { reviewId, score } of args.entries) {
      await ctx.db.patch(reviewId, { sentimentScore: score });
    }
  },
});

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
    source: v.optional(sourceValidator),
    sentiment: v.optional(sentimentValidator),
    hasText: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    if (args.source) {
      return await ctx.db
        .query("reviews")
        .withIndex("by_businessId_and_source_and_hasText_and_reviewDate", (q) => {
          const base = q.eq("businessId", args.businessId).eq("source", args.source!);
          return args.hasText !== undefined ? base.eq("hasText", args.hasText) : base;
        })
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.sentiment) {
      return await ctx.db
        .query("reviews")
        .withIndex("by_businessId_and_sentiment_and_hasText_and_reviewDate", (q) => {
          const base = q.eq("businessId", args.businessId).eq("sentiment", args.sentiment!);
          return args.hasText !== undefined ? base.eq("hasText", args.hasText) : base;
        })
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.hasText !== undefined) {
      return await ctx.db
        .query("reviews")
        .withIndex("by_businessId_and_hasText_and_reviewDate", (q) =>
          q.eq("businessId", args.businessId).eq("hasText", args.hasText!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("reviews")
      .withIndex("by_businessId_and_hasText_and_reviewDate", (q) =>
        q.eq("businessId", args.businessId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const searchByText = query({
  args: {
    businessId: v.id("businesses"),
    query: v.string(),
    source: v.optional(sourceValidator),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    return await ctx.db
      .query("reviews")
      .withSearchIndex("search_text", (q) => {
        const base = q.search("text", args.query).eq("businessId", args.businessId);
        return args.source ? base.eq("source", args.source) : base;
      })
      .take(20);
  },
});

export const remove = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new Error("Review not found");
    await requireBusinessOwner(ctx, review.businessId);
    await ctx.db.delete(args.reviewId);
    await ctx.scheduler.runAfter(0, internal.businessMetrics.recompute, {
      businessId: review.businessId,
    });
  },
});

export const searchForAgent = internalQuery({
  args: {
    businessId: v.id("businesses"),
    searchQuery: v.optional(v.string()),
    sentiment: v.optional(sentimentValidator),
    source: v.optional(sourceValidator),
    minRating: v.optional(v.number()),
    maxRating: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const format = (r: {
      rating: number;
      sentiment?: "positive" | "neutral" | "negative";
      source: string;
      text?: string;
      reviewDate: number;
      reviewerName?: string;
      topics?: string[];
    }) => ({
      rating: r.rating,
      sentiment: r.sentiment,
      source: r.source,
      text: r.text,
      date: new Date(r.reviewDate).toISOString().split("T")[0],
      reviewer: r.reviewerName,
      topics: r.topics,
    });

    if (args.searchQuery) {
      const results = await ctx.db
        .query("reviews")
        .withSearchIndex("search_text", (q) =>
          q.search("text", args.searchQuery!).eq("businessId", args.businessId),
        )
        .take(limit * 3);

      return results
        .filter((r) => {
          if (args.minRating !== undefined && r.rating < args.minRating) return false;
          if (args.maxRating !== undefined && r.rating > args.maxRating) return false;
          if (args.sentiment && r.sentiment !== args.sentiment) return false;
          if (args.source && r.source !== args.source) return false;
          return true;
        })
        .slice(0, limit)
        .map(format);
    }

    if (args.sentiment) {
      const results = await ctx.db
        .query("reviews")
        .withIndex("by_businessId_and_sentiment", (q) =>
          q.eq("businessId", args.businessId).eq("sentiment", args.sentiment!),
        )
        .order("desc")
        .take(limit * 2);

      return results
        .filter((r) => {
          if (args.minRating !== undefined && r.rating < args.minRating) return false;
          if (args.maxRating !== undefined && r.rating > args.maxRating) return false;
          if (args.source && r.source !== args.source) return false;
          return true;
        })
        .slice(0, limit)
        .map(format);
    }

    const results = await ctx.db
      .query("reviews")
      .withIndex("by_businessId_and_reviewDate", (q) =>
        q.eq("businessId", args.businessId),
      )
      .order("desc")
      .take(limit * 2);

    return results
      .filter((r) => {
        if (args.minRating !== undefined && r.rating < args.minRating) return false;
        if (args.maxRating !== undefined && r.rating > args.maxRating) return false;
        if (args.source && r.source !== args.source) return false;
        return true;
      })
      .slice(0, limit)
      .map(format);
  },
});

export const backfillHasText = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("reviews")
      .paginate({ cursor: args.cursor ?? null, numItems: 100 });
    for (const review of batch.page) {
      if (review.hasText === undefined) {
        await ctx.db.patch(review._id, { hasText: !!review.text?.trim() });
      }
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.reviews.backfillHasText, {
        cursor: batch.continueCursor,
      });
    }
  },
});
