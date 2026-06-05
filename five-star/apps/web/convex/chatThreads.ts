import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    title: v.optional(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    return await ctx.db.insert("chatThreads", {
      businessId: args.businessId,
      title: args.title ?? "New conversation",
      isArchived: false,
      messageCount: 0,
      context: args.context,
    });
  },
});

export const updateTitle = mutation({
  args: {
    threadId: v.id("chatThreads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    await requireBusinessOwner(ctx, thread.businessId);
    await ctx.db.patch(args.threadId, { title: args.title });
  },
});

export const archive = mutation({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    await requireBusinessOwner(ctx, thread.businessId);
    await ctx.db.patch(args.threadId, { isArchived: true });
  },
});

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isArchived !== undefined) {
      return await ctx.db
        .query("chatThreads")
        .withIndex("by_businessId_and_isArchived", (q) =>
          q
            .eq("businessId", args.businessId)
            .eq("isArchived", args.isArchived!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getById = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    await requireBusinessOwner(ctx, thread.businessId);
    return thread;
  },
});
