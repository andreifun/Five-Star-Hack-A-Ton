import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const upsertCurrentUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name ?? identity.name ?? existing.name,
        email: args.email ?? identity.email ?? existing.email,
        imageUrl: args.imageUrl ?? existing.imageUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      name: args.name ?? identity.name,
      email: args.email ?? identity.email,
      imageUrl: args.imageUrl,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<Doc<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
