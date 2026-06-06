import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

import { requireBusinessOwner } from "./helpers";

export const recompute = internalMutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .take(1000);

    const reviewCount = reviews.length;
    const ratingDistribution = { one: 0, two: 0, three: 0, four: 0, five: 0 };
    const reviewCountBySource: Record<string, number> = {};
    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    const topicCounts: Record<string, number> = {};
    let ratingSum = 0;
    let lastReviewDate: number | undefined;

    for (const review of reviews) {
      ratingSum += review.rating;

      const rounded = Math.round(review.rating);
      if (rounded === 1) ratingDistribution.one++;
      else if (rounded === 2) ratingDistribution.two++;
      else if (rounded === 3) ratingDistribution.three++;
      else if (rounded === 4) ratingDistribution.four++;
      else if (rounded === 5) ratingDistribution.five++;

      reviewCountBySource[review.source] =
        (reviewCountBySource[review.source] ?? 0) + 1;

      if (review.sentiment === "positive") sentimentBreakdown.positive++;
      else if (review.sentiment === "neutral") sentimentBreakdown.neutral++;
      else if (review.sentiment === "negative") sentimentBreakdown.negative++;

      if (review.topics) {
        for (const topic of review.topics) {
          topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
        }
      }

      if (lastReviewDate === undefined || review.reviewDate > lastReviewDate) {
        lastReviewDate = review.reviewDate;
      }
    }

    const avgRating = reviewCount > 0 ? ratingSum / reviewCount : 0;

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    const pendingTips = await ctx.db
      .query("tips")
      .withIndex("by_businessId_and_status", (q) =>
        q.eq("businessId", args.businessId).eq("status", "pending"),
      )
      .take(1000);

    const inProgressTips = await ctx.db
      .query("tips")
      .withIndex("by_businessId_and_status", (q) =>
        q.eq("businessId", args.businessId).eq("status", "in_progress"),
      )
      .take(1000);

    const completedTips = await ctx.db
      .query("tips")
      .withIndex("by_businessId_and_status", (q) =>
        q.eq("businessId", args.businessId).eq("status", "done"),
      )
      .take(1000);

    const existing = await ctx.db
      .query("businessMetrics")
      .withIndex("by_businessId", (q) =>
        q.eq("businessId", args.businessId),
      )
      .unique();

    const metricsData = {
      businessId: args.businessId,
      avgRating,
      reviewCount,
      ratingDistribution,
      reviewCountBySource,
      sentimentBreakdown,
      topTopics,
      pendingTipsCount: pendingTips.length,
      inProgressTipsCount: inProgressTips.length,
      completedTipsCount: completedTips.length,
      lastReviewDate,
      lastComputedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, metricsData);
    } else {
      await ctx.db.insert("businessMetrics", metricsData);
    }
  },
});

export const setPositivityScore = internalMutation({
  args: { businessId: v.id("businesses"), score: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("businessMetrics")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { positivityScore: args.score });
    }
  },
});

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    return await ctx.db
      .query("businessMetrics")
      .withIndex("by_businessId", (q) =>
        q.eq("businessId", args.businessId),
      )
      .unique();
  },
});
