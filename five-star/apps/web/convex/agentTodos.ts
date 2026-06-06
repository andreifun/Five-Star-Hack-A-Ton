import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

const priorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export const create = internalMutation({
  args: {
    businessId: v.id("businesses"),
    threadId: v.id("chatThreads"),
    title: v.string(),
    description: v.string(),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentTodos", {
      ...args,
      isCompleted: false,
    });
  },
});

export const listByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentTodos")
      .withIndex("by_businessId_and_isCompleted", (q) =>
        q.eq("businessId", args.businessId).eq("isCompleted", false),
      )
      .order("desc")
      .collect();
  },
});

export const listByThread = query({
  args: { businessId: v.id("businesses"), threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentTodos")
      .withIndex("by_businessId_and_isCompleted", (q) =>
        q.eq("businessId", args.businessId).eq("isCompleted", false),
      )
      .filter((q) => q.eq(q.field("threadId"), args.threadId))
      .order("desc")
      .collect();
  },
});

export const complete = mutation({
  args: { id: v.id("agentTodos") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isCompleted: true,
      completedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("agentTodos") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
