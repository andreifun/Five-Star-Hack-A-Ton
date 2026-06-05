"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";

const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

interface GeneratedTip {
  category:
    | "service"
    | "ambiance"
    | "menu"
    | "cleanliness"
    | "value"
    | "communication"
    | "operations"
    | "marketing"
    | "staff"
    | "other";
  priority: "high" | "medium" | "low";
  title: string;
  content: string;
  sourceReviewIndices: number[];
}

/**
 * Public, ownership-checked entry point for regenerating tips from the UI.
 * Verifies the caller owns the business (via the auth-gated `getById`, whose
 * identity propagates from the authenticated client) before running the
 * internal generation action.
 */
export const regenerate = action({
  args: {
    businessId: v.id("businesses"),
    model: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args: { businessId: Id<"businesses">; model?: string },
  ): Promise<void> => {
    const business = await ctx.runQuery(api.businesses.getById, {
      businessId: args.businessId,
    });
    if (!business) throw new Error("Business not found or access denied");

    await ctx.runAction(internal.ai.generateTips.generateTipsForBusiness, {
      businessId: args.businessId,
      model: args.model,
    });
  },
});

export const generateTipsForBusiness = internalAction({
  args: {
    businessId: v.id("businesses"),
    model: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args: { businessId: Id<"businesses">; model?: string },
  ): Promise<void> => {
    const modelId = args.model ?? "minimax/minimax-m3";

    const businessWithMetrics = (await ctx.runQuery(
      internal.businesses.getByIdInternal,
      { businessId: args.businessId },
    )) as ({ metrics: Doc<"businessMetrics"> | null } & Doc<"businesses">) | null;

    if (!businessWithMetrics) throw new Error("Business not found");

    const reviews = (await ctx.runQuery(internal.reviews.listRecentInternal, {
      businessId: args.businessId,
      limit: 50,
    })) as Doc<"reviews">[];

    const pendingTips = (await ctx.runQuery(
      internal.tips.listByStatusInternal,
      { businessId: args.businessId, status: "pending", limit: 20 },
    )) as Doc<"tips">[];

    const businessContext = `
Business: ${businessWithMetrics.name}
Type: ${businessWithMetrics.type}
Location: ${[businessWithMetrics.city, businessWithMetrics.country].filter(Boolean).join(", ") || "Not specified"}
Description: ${businessWithMetrics.description || "Not provided"}
Price range: ${businessWithMetrics.priceRange || "Not specified"}
${businessWithMetrics.cuisineTypes?.length ? `Cuisine: ${businessWithMetrics.cuisineTypes.join(", ")}` : ""}
${businessWithMetrics.starRating ? `Star rating: ${businessWithMetrics.starRating}` : ""}
${businessWithMetrics.capacity ? `Capacity: ${businessWithMetrics.capacity} guests` : ""}

Metrics:
- Average rating: ${businessWithMetrics.metrics?.avgRating.toFixed(2) ?? "N/A"} / 5
- Total reviews: ${businessWithMetrics.metrics?.reviewCount ?? 0}
- Sentiment: ${businessWithMetrics.metrics ? `${businessWithMetrics.metrics.sentimentBreakdown.positive} positive, ${businessWithMetrics.metrics.sentimentBreakdown.neutral} neutral, ${businessWithMetrics.metrics.sentimentBreakdown.negative} negative` : "N/A"}
- Top topics mentioned: ${businessWithMetrics.metrics?.topTopics.slice(0, 5).join(", ") || "None yet"}
`.trim();

    const reviewsText = reviews
      .map(
        (r: Doc<"reviews">, i: number) =>
          `[${i}] Rating: ${r.rating}/5 | Source: ${r.source} | Sentiment: ${r.sentiment ?? "unknown"}
${r.title ? `Title: ${r.title}` : ""}
${r.text ? `Review: ${r.text}` : "(no text)"}
${r.topics?.length ? `Topics: ${r.topics.join(", ")}` : ""}`,
      )
      .join("\n\n");

    const pendingTitles = pendingTips.map((t: Doc<"tips">) => t.title).join(", ");

    const prompt = `You are an expert hospitality consultant helping a ${businessWithMetrics.type} owner improve their business.

${businessContext}

Recent customer reviews (up to 50):
${reviewsText || "No reviews yet."}

${pendingTitles ? `Already pending tips (do not duplicate): ${pendingTitles}` : ""}

Based on the reviews and business context, generate 3-7 specific, actionable improvement tips. Each tip must:
- Be concrete and immediately actionable
- Reference specific patterns from reviews where relevant
- Be realistic for this type of business
- Not duplicate any already-pending tips listed above

Respond with a JSON array of tips with this exact structure:
[
  {
    "category": "service|ambiance|menu|cleanliness|value|communication|operations|marketing|staff|other",
    "priority": "high|medium|low",
    "title": "Short descriptive title (max 80 chars)",
    "content": "Detailed actionable advice (2-4 sentences)",
    "sourceReviewIndices": [0, 2, 5]
  }
]

Only output valid JSON, no markdown, no explanation.`;

    const { text: rawText } = await generateText({
      model: gateway(modelId),
      prompt,
      maxOutputTokens: 2048,
    });

    let tips: GeneratedTip[] = [];
    try {
      tips = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse AI tip response:", rawText);
      return;
    }

    for (const tip of tips) {
      const sourceReviewIds = (tip.sourceReviewIndices ?? [])
        .filter((i: number) => i >= 0 && i < reviews.length)
        .map((i: number) => reviews[i]!._id);

      await ctx.runMutation(internal.tips.create, {
        businessId: args.businessId,
        category: tip.category,
        priority: tip.priority,
        title: tip.title,
        content: tip.content,
        generatedByModel: modelId,
        sourceReviewIds: sourceReviewIds.length > 0 ? sourceReviewIds : undefined,
      });
    }

    await ctx.runMutation(internal.businessMetrics.recompute, {
      businessId: args.businessId,
    });
  },
});
