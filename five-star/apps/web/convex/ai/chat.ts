"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";

const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export const sendMessage = action({
  args: {
    threadId: v.id("chatThreads"),
    businessId: v.id("businesses"),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const modelId = args.model ?? "anthropic/claude-sonnet-4-5";

    await ctx.runMutation(internal.chatMessages.addMessage, {
      threadId: args.threadId,
      businessId: args.businessId,
      role: "user",
      content: args.content,
      isError: false,
    });

    const [history, businessWithMetrics, recentReviewsPage, pendingTipsPage] =
      await Promise.all([
        ctx.runQuery(internal.chatMessages.getRecentForContext, {
          threadId: args.threadId,
          limit: 20,
        }) as Promise<Doc<"chatMessages">[]>,
        ctx.runQuery(api.businesses.getById, {
          businessId: args.businessId,
        }) as Promise<
          { metrics: Doc<"businessMetrics"> | null } & Doc<"businesses">
        >,
        ctx.runQuery(api.reviews.listByBusiness, {
          businessId: args.businessId,
          paginationOpts: { numItems: 10, cursor: null },
        }),
        ctx.runQuery(api.tips.listByBusiness, {
          businessId: args.businessId,
          paginationOpts: { numItems: 10, cursor: null },
          status: "pending",
        }),
      ]);

    const metrics = businessWithMetrics.metrics;
    const recentReviews = recentReviewsPage.page;
    const pendingTips = pendingTipsPage.page;

    const systemPrompt = `You are an expert hospitality consultant and business coach for ${businessWithMetrics.name}, a ${businessWithMetrics.type} business. You help the owner understand their customer feedback and improve their service quality.

Business Profile:
- Name: ${businessWithMetrics.name}
- Type: ${businessWithMetrics.type}
- Location: ${[businessWithMetrics.city, businessWithMetrics.country].filter(Boolean).join(", ") || "Not specified"}
- Description: ${businessWithMetrics.description || "Not provided"}
- Price range: ${businessWithMetrics.priceRange || "Not specified"}
${businessWithMetrics.cuisineTypes?.length ? `- Cuisine types: ${businessWithMetrics.cuisineTypes.join(", ")}` : ""}
${businessWithMetrics.starRating ? `- Star rating: ${businessWithMetrics.starRating}` : ""}
${businessWithMetrics.capacity ? `- Capacity: ${businessWithMetrics.capacity} guests` : ""}

Current Performance Metrics:
- Average rating: ${metrics?.avgRating.toFixed(2) ?? "N/A"} / 5 (from ${metrics?.reviewCount ?? 0} reviews)
- Sentiment: ${metrics ? `${metrics.sentimentBreakdown.positive} positive, ${metrics.sentimentBreakdown.neutral} neutral, ${metrics.sentimentBreakdown.negative} negative` : "N/A"}
- Top topics in reviews: ${metrics?.topTopics.slice(0, 8).join(", ") || "None yet"}
- Pending improvement tips: ${metrics?.pendingTipsCount ?? 0}

Recent Customer Reviews (last 10):
${recentReviews.length > 0 ? recentReviews.map((r) => `- [${r.rating}/5, ${r.source}] ${r.text ?? "(no text)"}`).join("\n") : "No reviews yet."}

Active Improvement Tips:
${pendingTips.length > 0 ? pendingTips.map((t) => `- [${t.priority}] ${t.title}: ${t.content}`).join("\n") : "No pending tips."}

Your role:
- Answer questions about the business's performance, reviews, and improvement areas
- Provide specific, actionable advice tailored to this ${businessWithMetrics.type}
- Reference actual data from reviews and metrics when relevant
- Be encouraging but honest about areas needing improvement
- Keep responses concise and practical`;

    const messages: { role: "user" | "assistant"; content: string }[] = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    let assistantContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let isError = false;
    let errorMessage: string | undefined;

    try {
      const result = await generateText({
        model: gateway(modelId),
        system: systemPrompt,
        messages,
        maxTokens: 1024,
      });

      assistantContent = result.text;
      inputTokens = result.usage.promptTokens;
      outputTokens = result.usage.completionTokens;
    } catch (err) {
      isError = true;
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      assistantContent =
        "I encountered an error processing your request. Please try again.";
    }

    const messageId = await ctx.runMutation(internal.chatMessages.addMessage, {
      threadId: args.threadId,
      businessId: args.businessId,
      role: "assistant",
      content: assistantContent,
      model: modelId,
      inputTokens,
      outputTokens,
      isError,
      errorMessage,
    });

    return { content: assistantContent, messageId, isError };
  },
});
