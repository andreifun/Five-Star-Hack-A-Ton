import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";
import { Doc } from "./_generated/dataModel";

const roleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
);

export const addMessage = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    businessId: v.id("businesses"),
    role: roleValidator,
    content: v.string(),
    model: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    referencedTipIds: v.optional(v.array(v.id("tips"))),
    referencedReviewIds: v.optional(v.array(v.id("reviews"))),
    isError: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { isError = false, ...rest } = args;
    const messageId = await ctx.db.insert("chatMessages", {
      ...rest,
      isError,
    });

    const thread = await ctx.db.get(args.threadId);
    if (thread) {
      await ctx.db.patch(args.threadId, {
        lastMessageAt: Date.now(),
        messageCount: thread.messageCount + 1,
      });
    }

    return messageId;
  },
});

export const listByThread = query({
  args: {
    threadId: v.id("chatThreads"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    await requireBusinessOwner(ctx, thread.businessId);

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .paginate(args.paginationOpts);
  },
});

export const getRecentForContext = query({
  args: {
    threadId: v.id("chatThreads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"chatMessages">[]> => {
    const limit = args.limit ?? 20;
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(limit);
    return messages.reverse();
  },
});
