"use node";

import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";

const gateway = createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY });

export const draft = action({
  args: { businessId: v.id("businesses"), tipId: v.id("tips"), instructions: v.string(), model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tip = await ctx.runQuery(api.tips.getById, { tipId: args.tipId });
    if (!tip || tip.businessId !== args.businessId) throw new Error("Tip not found");
    const { text } = await generateText({
      model: gateway(args.model ?? "anthropic/claude-sonnet-4-5"),
      system: "Draft a professional plain-text business email. Return only JSON with subject and body string fields.",
      prompt: `Tip: ${tip.title}\nContext: ${tip.content}\nInstructions: ${args.instructions}`,
      maxOutputTokens: 900,
    });
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as { subject: string; body: string };
    return { subject: parsed.subject, body: parsed.body };
  },
});

export const send = action({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.runQuery(api.emailDrafts.getById, { draftId: args.draftId });
    if (!draft) throw new Error("Draft not found");
    if (
      draft.status !== "approved" ||
      JSON.stringify(draft.recipients) !== JSON.stringify(draft.approvedRecipients) ||
      draft.subject !== draft.approvedSubject ||
      draft.body !== draft.approvedBody
    ) throw new Error("The final recipients, subject, and body must be explicitly approved before sending");
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured");
    await ctx.runMutation(internal.emailDrafts.setDelivery, { draftId: args.draftId, status: "sending" });
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: draft.recipients, subject: draft.subject, text: draft.body }),
      });
      const data = await response.json() as { id?: string; message?: string };
      if (!response.ok || !data.id) throw new Error(data.message ?? `Resend request failed (${response.status})`);
      await ctx.runMutation(internal.emailDrafts.setDelivery, { draftId: args.draftId, status: "sent", providerId: data.id });
      return { providerId: data.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email delivery failed";
      await ctx.runMutation(internal.emailDrafts.setDelivery, { draftId: args.draftId, status: "failed", error: message });
      throw error;
    }
  },
});
