import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";

const sourceValidator = v.object({
  title: v.string(),
  url: v.string(),
  snippet: v.optional(v.string()),
});

export const create = mutation({
  args: { businessId: v.id("businesses"), tipId: v.id("tips"), query: v.string() },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tip = await ctx.db.get(args.tipId);
    if (!tip || tip.businessId !== args.businessId) throw new Error("Tip not found");
    const now = Date.now();
    return await ctx.db.insert("researchReports", {
      ...args,
      status: "pending",
      sources: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listByTip = query({
  args: { businessId: v.id("businesses"), tipId: v.id("tips") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tip = await ctx.db.get(args.tipId);
    if (!tip || tip.businessId !== args.businessId) throw new Error("Tip not found");
    return await ctx.db.query("researchReports").withIndex("by_tipId", (q) => q.eq("tipId", args.tipId)).order("desc").take(50);
  },
});

export const getById = query({
  args: { reportId: v.id("researchReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    await requireBusinessOwner(ctx, report.businessId);
    return report;
  },
});

export const setResult = internalMutation({
  args: {
    reportId: v.id("researchReports"),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    sources: v.optional(v.array(sourceValidator)),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reportId, ...patch } = args;
    await ctx.db.patch(reportId, { ...patch, updatedAt: Date.now() });
  },
});
