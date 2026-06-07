import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { requireBusinessOwner } from "./helpers"

const priorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
)

export const create = internalMutation({
  args: {
    businessId: v.id("businesses"),
    threadId: v.id("chatThreads"),
    tipId: v.optional(v.id("tips")),
    title: v.string(),
    description: v.string(),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    return await ctx.db.insert("agentTodos", {
      ...args,
      isCompleted: false,
    })
  },
})

export const completeFromAgent = internalMutation({
  args: {
    businessId: v.id("businesses"),
    threadId: v.id("chatThreads"),
    id: v.id("agentTodos"),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    const todo = await ctx.db.get(args.id)
    if (
      !todo ||
      todo.businessId !== args.businessId ||
      todo.threadId !== args.threadId
    ) {
      throw new Error("Action item not found in this conversation")
    }
    await ctx.db.patch(args.id, {
      isCompleted: true,
      completedAt: Date.now(),
    })
  },
})

export const listByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    return await ctx.db
      .query("agentTodos")
      .withIndex("by_businessId_and_isCompleted", (q) =>
        q.eq("businessId", args.businessId).eq("isCompleted", false)
      )
      .order("desc")
      .take(100)
  },
})

export const listAllByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    return await ctx.db
      .query("agentTodos")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .take(500)
  },
})

export const listByThread = query({
  args: { businessId: v.id("businesses"), threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.businessId !== args.businessId)
      throw new Error("Thread not found")
    return await ctx.db
      .query("agentTodos")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(100)
  },
})

export const listByTip = query({
  args: { businessId: v.id("businesses"), tipId: v.id("tips") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    const tip = await ctx.db.get(args.tipId)
    if (!tip || tip.businessId !== args.businessId)
      throw new Error("Tip not found")
    return await ctx.db
      .query("agentTodos")
      .withIndex("by_tipId", (q) => q.eq("tipId", args.tipId))
      .order("desc")
      .take(100)
  },
})

export const createForTip = mutation({
  args: {
    businessId: v.id("businesses"),
    tipId: v.id("tips"),
    threadId: v.id("chatThreads"),
    title: v.string(),
    description: v.string(),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId)
    const [tip, thread] = await Promise.all([
      ctx.db.get(args.tipId),
      ctx.db.get(args.threadId),
    ])
    if (
      !tip ||
      tip.businessId !== args.businessId ||
      !thread ||
      thread.tipId !== args.tipId
    ) {
      throw new Error("Invalid tip workspace")
    }
    return await ctx.db.insert("agentTodos", { ...args, isCompleted: false })
  },
})

export const complete = mutation({
  args: { id: v.id("agentTodos") },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.id)
    if (!todo) throw new Error("Todo not found")
    await requireBusinessOwner(ctx, todo.businessId)
    await ctx.db.patch(args.id, {
      isCompleted: true,
      completedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id("agentTodos") },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.id)
    if (!todo) throw new Error("Todo not found")
    await requireBusinessOwner(ctx, todo.businessId)
    await ctx.db.delete(args.id)
  },
})
