import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { requireBusinessOwner } from "./helpers"

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    tipId: v.optional(v.id("tips")),
    title: v.optional(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    if (args.tipId) {
      const tip = await ctx.db.get(args.tipId)
      if (!tip || tip.businessId !== args.businessId)
        throw new Error("Tip not found")
      const existing = await ctx.db
        .query("chatThreads")
        .withIndex("by_tipId", (q) => q.eq("tipId", args.tipId))
        .unique()
      if (existing) return existing._id
    }
    return await ctx.db.insert("chatThreads", {
      businessId: args.businessId,
      tipId: args.tipId,
      title: args.title ?? "New conversation",
      isArchived: false,
      messageCount: 0,
      context: args.context,
      kickoffStatus: args.tipId ? "pending" : undefined,
    })
  },
})

export const updateTitle = mutation({
  args: {
    threadId: v.id("chatThreads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread) throw new Error("Thread not found")
    await requireBusinessOwner(ctx, thread.businessId)
    await ctx.db.patch(args.threadId, { title: args.title })
  },
})

export const getOrCreateForTip = mutation({
  args: { businessId: v.id("businesses"), tipId: v.id("tips") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    const tip = await ctx.db.get(args.tipId)
    if (!tip || tip.businessId !== args.businessId)
      throw new Error("Tip not found")
    const existing = await ctx.db
      .query("chatThreads")
      .withIndex("by_tipId", (q) => q.eq("tipId", args.tipId))
      .unique()
    if (existing) {
      if (existing.title !== tip.title || existing.context !== tip.content) {
        await ctx.db.patch(existing._id, {
          title: tip.title,
          context: tip.content,
        })
      }
      return existing._id
    }
    return await ctx.db.insert("chatThreads", {
      businessId: args.businessId,
      tipId: args.tipId,
      title: tip.title,
      isArchived: false,
      messageCount: 0,
      context: tip.content,
      kickoffStatus: "pending",
    })
  },
})

export const claimKickoff = mutation({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread) throw new Error("Thread not found")
    await requireBusinessOwner(ctx, thread.businessId)
    if (
      !thread.tipId ||
      thread.messageCount > 0 ||
      (thread.kickoffStatus !== undefined &&
        thread.kickoffStatus !== "pending" &&
        thread.kickoffStatus !== "failed")
    ) {
      return false
    }
    await ctx.db.patch(args.threadId, {
      kickoffStatus: "running",
      kickoffError: undefined,
    })
    return true
  },
})

export const finishKickoff = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      kickoffStatus: args.status,
      kickoffError: args.error,
    })
  },
})

export const archive = mutation({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread) throw new Error("Thread not found")
    await requireBusinessOwner(ctx, thread.businessId)
    await ctx.db.patch(args.threadId, { isArchived: true })
  },
})

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    if (args.isArchived !== undefined) {
      return await ctx.db
        .query("chatThreads")
        .withIndex("by_businessId_and_isArchived", (q) =>
          q.eq("businessId", args.businessId).eq("isArchived", args.isArchived!)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    }
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread) return null
    await requireBusinessOwner(ctx, thread.businessId)
    return thread
  },
})
