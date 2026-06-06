"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";

const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export const regenerate = action({
  args: {
    businessId: v.id("businesses"),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.businesses.getByIdInternal, {
      businessId: args.businessId,
    });
    await ctx.runAction(
      internal.ai.calculatePositivity.calculatePositivityForBusiness,
      { businessId: args.businessId, model: args.model },
    );
  },
});

export const calculatePositivityForBusiness = internalAction({
  args: {
    businessId: v.id("businesses"),
    model: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args: { businessId: Id<"businesses">; model?: string },
  ): Promise<void> => {
    const modelId = args.model ?? "google/gemma-4-31b-it";

    const businessWithMetrics = (await ctx.runQuery(
      internal.businesses.getByIdInternal,
      { businessId: args.businessId },
    )) as ({ metrics: Doc<"businessMetrics"> | null } & Doc<"businesses">) | null;

    if (!businessWithMetrics) throw new Error("Business not found");

    const reviews = (await ctx.runQuery(internal.reviews.listRecentInternal, {
      businessId: args.businessId,
      limit: 50,
    })) as Doc<"reviews">[];

    if (reviews.length === 0) return;

    const reviewsText = reviews
      .map(
        (r: Doc<"reviews">, i: number) =>
          `[${i}] Actual stars: ${r.rating}/5${r.text ? `\nReview text: ${r.text}` : " (no text)"}`,
      )
      .join("\n\n");

    const prompt = `You are an expert sentiment analyst. You will be given a list of customer reviews for a ${businessWithMetrics.type}, each with the actual star rating given and the review text.

For each review that has text, predict what star rating (1-5) you would assign based solely on the text content — ignoring the actual stars. Then compare your text-based prediction to the actual stars given to detect misalignment.

Using all of the following signals together:
- The actual star ratings (absolute sentiment level)
- The sentiment and tone of the review texts
- The gap between your text-predicted stars and the actual stars (positive gap = reviewer gave more stars than text suggests; negative gap = reviewer gave fewer stars than text suggests)

Calculate a single POSITIVITY SCORE for this business that represents the overall customer sentiment on a scale from -10 to 10, where:
- -10 = extremely negative (very bad experience across all reviews)
- 0 = completely neutral or mixed
- +10 = extremely positive (outstanding experience across all reviews)

Reviews:
${reviewsText}

Respond ONLY with a valid JSON object in this exact format, no markdown, no explanation:
{"score": <number between -10 and 10, one decimal place allowed>}`;

    const { text: rawText } = await generateText({
      model: gateway(modelId),
      prompt,
      maxOutputTokens: 256,
    });

    let score: number;
    try {
      const parsed = JSON.parse(rawText.trim()) as { score: number };
      score = parsed.score;
    } catch {
      const match = rawText.match(/-?\d+(\.\d+)?/);
      if (!match) {
        console.error("Failed to parse positivity score:", rawText);
        return;
      }
      score = parseFloat(match[0]);
    }

    score = Math.max(-10, Math.min(10, score));

    await ctx.runMutation(internal.businessMetrics.setPositivityScore, {
      businessId: args.businessId,
      score,
    });
  },
});
