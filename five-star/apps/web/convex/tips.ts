import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";
import { internal } from "./_generated/api";

const categoryValidator = v.union(
  v.literal("service"),
  v.literal("ambiance"),
  v.literal("menu"),
  v.literal("cleanliness"),
  v.literal("value"),
  v.literal("communication"),
  v.literal("operations"),
  v.literal("marketing"),
  v.literal("staff"),
  v.literal("other"),
);

const priorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("dismissed"),
);

export const create = internalMutation({
  args: {
    businessId: v.id("businesses"),
    category: categoryValidator,
    priority: priorityValidator,
    title: v.string(),
    content: v.string(),
    generatedByModel: v.optional(v.string()),
    sourceReviewIds: v.optional(v.array(v.id("reviews"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tips", {
      ...args,
      status: "pending",
    });
  },
});

export const updateStatus = mutation({
  args: {
    tipId: v.id("tips"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const tip = await ctx.db.get(args.tipId);
    if (!tip) throw new Error("Tip not found");
    await requireBusinessOwner(ctx, tip.businessId);

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "done") patch.completedAt = Date.now();
    if (args.status === "dismissed") patch.dismissedAt = Date.now();

    await ctx.db.patch(args.tipId, patch);
    await ctx.scheduler.runAfter(0, internal.businessMetrics.recompute, {
      businessId: tip.businessId,
    });
  },
});

export const addNotes = mutation({
  args: {
    tipId: v.id("tips"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const tip = await ctx.db.get(args.tipId);
    if (!tip) throw new Error("Tip not found");
    await requireBusinessOwner(ctx, tip.businessId);
    await ctx.db.patch(args.tipId, { notes: args.notes });
  },
});

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(statusValidator),
    category: v.optional(categoryValidator),
    priority: v.optional(priorityValidator),
  },
  handler: async (ctx, args) => {
    if (args.status && args.priority) {
      return await ctx.db
        .query("tips")
        .withIndex("by_businessId_and_priority_and_status", (q) =>
          q
            .eq("businessId", args.businessId)
            .eq("priority", args.priority!)
            .eq("status", args.status!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.status) {
      return await ctx.db
        .query("tips")
        .withIndex("by_businessId_and_status", (q) =>
          q.eq("businessId", args.businessId).eq("status", args.status!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.category) {
      return await ctx.db
        .query("tips")
        .withIndex("by_businessId_and_category", (q) =>
          q.eq("businessId", args.businessId).eq("category", args.category!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("tips")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getById = query({
  args: { tipId: v.id("tips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tipId);
  },
});
