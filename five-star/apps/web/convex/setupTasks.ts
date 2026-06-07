import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";
import { Doc } from "./_generated/dataModel";

const TASK_DEFINITIONS: Array<{
  type: Doc<"setupTasks">["type"];
  label: string;
  order: number;
}> = [
  { type: "classify_location", label: "Classifying location", order: 0 },
  { type: "fetch_website", label: "Scanning your website", order: 1 },
  { type: "fetch_google", label: "Importing Google profile", order: 2 },
  { type: "generate_tips", label: "Generating improvement tips", order: 3 },
  { type: "finalize", label: "Finalizing setup", order: 4 },
];

export const createForBusiness = internalMutation({
  args: {
    businessId: v.id("businesses"),
    hasLocation: v.boolean(),
    hasWebsite: v.boolean(),
    hasGoogle: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const urlFlags: Record<string, boolean> = {
      classify_location: args.hasLocation,
      fetch_website: args.hasWebsite,
      fetch_google: args.hasGoogle,
    };

    for (const def of TASK_DEFINITIONS) {
      const hasUrl = def.type in urlFlags ? urlFlags[def.type] : true;
      await ctx.db.insert("setupTasks", {
        businessId: args.businessId,
        type: def.type,
        label: def.label,
        status: hasUrl ? "pending" : "skipped",
        order: def.order,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updateStatus = internalMutation({
  args: {
    taskId: v.id("setupTasks"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.status,
      message: args.message,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Lists setup tasks **without** an ownership check, for use from the internal
 * setup action only (which runs without a user identity).
 */
export const listByBusinessInternal = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("setupTasks")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();
    return tasks.sort((a, b) => a.order - b.order);
  },
});

export const listByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tasks = await ctx.db
      .query("setupTasks")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();
    return tasks.sort((a, b) => a.order - b.order);
  },
});

export const getOverview = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const business = await ctx.db.get(args.businessId);
    if (!business) return null;

    const [tasks, reviews, tips] = await Promise.all([
      ctx.db
        .query("setupTasks")
        .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
        .collect(),
      ctx.db
        .query("tips")
        .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
        .collect(),
    ]);

    const reviewsBySource: Record<string, number> = {};
    for (const review of reviews) {
      reviewsBySource[review.source] = (reviewsBySource[review.source] ?? 0) + 1;
    }

    const socialLinks = business.socialLinks ?? {};
    const connectedSources = [
      business.website ? "website" : null,
      socialLinks.google ? "google" : null,
      socialLinks.tripadvisor ? "tripadvisor" : null,
      socialLinks.yelp ? "yelp" : null,
    ].filter((source): source is string => source !== null);

    return {
      tasks: tasks.sort((a, b) => a.order - b.order),
      discoveries: {
        connectedSources,
        reviewCount: reviews.length,
        reviewsBySource,
        tipCount: tips.length,
      },
      profile: {
        name: business.name,
        ...(business.description ? { description: business.description } : {}),
        ...(business.address ? { address: business.address } : {}),
        ...(business.city ? { city: business.city } : {}),
        ...(business.country ? { country: business.country } : {}),
        ...(business.phone ? { phone: business.phone } : {}),
        ...(business.openingHours ? { openingHours: business.openingHours } : {}),
        ...(business.mapsWebsite ?? business.website
          ? { website: business.mapsWebsite ?? business.website }
          : {}),
        ...(business.locationType ? { locationType: business.locationType } : {}),
      },
    };
  },
});

export const allCompleted = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tasks = await ctx.db
      .query("setupTasks")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();
    if (tasks.length === 0) return false;
    return tasks.every((t) => t.status !== "pending" && t.status !== "running");
  },
});

export const hasAnyFailed = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tasks = await ctx.db
      .query("setupTasks")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();
    return tasks.some((t) => t.status === "failed");
  },
});

export const resetFailed = internalMutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("setupTasks")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();
    const now = Date.now();
    for (const task of tasks) {
      if (task.status === "failed") {
        await ctx.db.patch(task._id, { status: "pending", message: undefined, updatedAt: now });
      }
    }
  },
});

export const resetAll = internalMutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("setupTasks")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .collect();
    const now = Date.now();
    for (const task of tasks) {
      if (task.status !== "skipped") {
        await ctx.db.patch(task._id, { status: "pending", message: undefined, updatedAt: now });
      }
    }
  },
});
