"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { getAiGateway } from "./env";
import { generateText } from "ai";

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
    const gateway = getAiGateway();

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

Calculate:
1. A single overall POSITIVITY SCORE for this business (−10 to 10)
2. An individual POSITIVITY SCORE for each review (−10 to 10), in the same order as the input list

Scale:
- −10 = extremely negative
- 0 = completely neutral or mixed
- +10 = extremely positive

Reviews:
${reviewsText}

Respond ONLY with a valid JSON object in this exact format, no markdown, no explanation:
{"score": <overall score, one decimal allowed>, "reviewScores": [<score for review 0>, <score for review 1>, ...]}`;

    const { text: rawText } = await generateText({
      model: gateway(modelId),
      prompt,
      maxOutputTokens: 512,
    });

    let score: number;
    let reviewScores: number[] = [];
    try {
      const parsed = JSON.parse(rawText.trim()) as {
        score: number;
        reviewScores: number[];
      };
      score = parsed.score;
      reviewScores = Array.isArray(parsed.reviewScores) ? parsed.reviewScores : [];
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

    if (reviewScores.length > 0) {
      const reviewScoreEntries = reviewScores
        .slice(0, reviews.length)
        .map((s, i) => ({
          reviewId: reviews[i]!._id,
          score: Math.max(-10, Math.min(10, s)),
        }));

      await ctx.runMutation(internal.reviews.setReviewPositivityScores, {
        entries: reviewScoreEntries,
      });
    }
  },
});
