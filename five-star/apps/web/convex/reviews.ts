import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";
import { internal } from "./_generated/api";

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
    const reviewId = await ctx.db.insert("reviews", args);
    await ctx.scheduler.runAfter(0, internal.businessMetrics.recompute, {
      businessId: args.businessId,
    });
    return reviewId;
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

    let imported = 0;
    for (const review of batch) {
      if (review.externalId && review.source !== "manual") {
        const existing = await ctx.db
          .query("reviews")
          .withIndex("by_businessId_and_source", (q) =>
            q
              .eq("businessId", args.businessId)
              .eq("source", review.source),
          )
          .take(1000);
        const duplicate = existing.find(
          (r) => r.externalId === review.externalId,
        );
        if (duplicate) continue;
      }
      await ctx.db.insert("reviews", {
        businessId: args.businessId,
        ...review,
      });
      imported++;
    }

    if (remaining.length > 0) {
      await ctx.scheduler.runAfter(0, internal.reviews.bulkImport, {
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

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
    source: v.optional(sourceValidator),
    sentiment: v.optional(sentimentValidator),
  },
  handler: async (ctx, args) => {
    if (args.source) {
      return await ctx.db
        .query("reviews")
        .withIndex("by_businessId_and_source", (q) =>
          q.eq("businessId", args.businessId).eq("source", args.source!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.sentiment) {
      return await ctx.db
        .query("reviews")
        .withIndex("by_businessId_and_sentiment", (q) =>
          q.eq("businessId", args.businessId).eq("sentiment", args.sentiment!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("reviews")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
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
