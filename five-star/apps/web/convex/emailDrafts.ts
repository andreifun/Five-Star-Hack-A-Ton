import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    tipId: v.id("tips"),
    recipients: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tip = await ctx.db.get(args.tipId);
    if (!tip || tip.businessId !== args.businessId) throw new Error("Tip not found");
    const now = Date.now();
    return await ctx.db.insert("emailDrafts", { ...args, status: "draft", createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: { draftId: v.id("emailDrafts"), recipients: v.array(v.string()), subject: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    await requireBusinessOwner(ctx, draft.businessId);
    const { draftId, ...content } = args;
    await ctx.db.patch(draftId, {
      ...content,
      status: "draft",
      approvedRecipients: undefined,
      approvedSubject: undefined,
      approvedBody: undefined,
      approvedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const approve = mutation({
  args: { draftId: v.id("emailDrafts"), recipients: v.array(v.string()), subject: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    await requireBusinessOwner(ctx, draft.businessId);
    if (args.recipients.length === 0 || !args.subject.trim() || !args.body.trim()) throw new Error("Recipients, subject, and body are required");
    await ctx.db.patch(args.draftId, {
      recipients: args.recipients,
      subject: args.subject,
      body: args.body,
      approvedRecipients: args.recipients,
      approvedSubject: args.subject,
      approvedBody: args.body,
      status: "approved",
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    await requireBusinessOwner(ctx, draft.businessId);
    return draft;
  },
});

export const listByTip = query({
  args: { businessId: v.id("businesses"), tipId: v.id("tips") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    const tip = await ctx.db.get(args.tipId);
    if (!tip || tip.businessId !== args.businessId) throw new Error("Tip not found");
    return await ctx.db.query("emailDrafts").withIndex("by_tipId", (q) => q.eq("tipId", args.tipId)).order("desc").take(50);
  },
});

export const setDelivery = internalMutation({
  args: {
    draftId: v.id("emailDrafts"),
    status: v.union(v.literal("sending"), v.literal("sent"), v.literal("failed")),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { draftId, status, ...rest } = args;
    await ctx.db.patch(draftId, { ...rest, status, sentAt: status === "sent" ? Date.now() : undefined, updatedAt: Date.now() });
  },
});
