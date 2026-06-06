"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { getAiGateway } from "./env";
import { generateText } from "ai";

const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const BATCH_SIZE = 50;

// Star-rating-based fallback score for reviews the AI skips or when parsing fails
function starToScore(rating: number): number {
  return Math.max(-10, Math.min(10, (rating - 3) * 4));
}

// Ensure the AI-returned array has exactly `expected` entries.
// Any missing tail entries are filled with the deterministic fallback.
function padScores(
  aiScores: number[],
  batch: Doc<"reviews">[],
): number[] {
  const result: number[] = [];
  for (let i = 0; i < batch.length; i++) {
    const ai = aiScores[i];
    result.push(typeof ai === "number" && isFinite(ai) ? ai : starToScore(batch[i]!.rating));
  }
  return result;
}

function padAngerFlags(
  aiFlags: boolean[],
  expected: number,
): boolean[] {
  const result: boolean[] = [];
  for (let i = 0; i < expected; i++) {
    result.push(typeof aiFlags[i] === "boolean" ? aiFlags[i]! : false);
  }
  return result;
}

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

    // Fetch ALL reviews, not just the most recent 50
    const allReviews = (await ctx.runQuery(internal.reviews.listRecentInternal, {
      businessId: args.businessId,
      limit: 1000,
    })) as Doc<"reviews">[];

    if (allReviews.length === 0) return;

    let overallScore: number | null = null;

    // Process reviews in batches to keep each prompt within token limits
    for (let batchStart = 0; batchStart < allReviews.length; batchStart += BATCH_SIZE) {
      const batch = allReviews.slice(batchStart, batchStart + BATCH_SIZE);

      const reviewsText = batch
        .map(
          (r: Doc<"reviews">, i: number) =>
            `[${i}] Actual stars: ${r.rating}/5${r.text ? `\nReview text: ${r.text}` : " (no text)"}`,
        )
        .join("\n\n");

      const prompt = `You are an expert sentiment analyst. You will be given a list of customer reviews for a ${businessWithMetrics.type}, each with the actual star rating given and the review text.

For reviews that have text, predict what star rating (1-5) you would assign based solely on the text content — ignoring the actual stars. Then compare your text-based prediction to the actual stars given to detect misalignment.

Using all of the following signals together:
- The actual star ratings (absolute sentiment level)
- The sentiment and tone of the review texts
- The gap between your text-predicted stars and the actual stars

Calculate:
1. A single overall POSITIVITY SCORE for this batch (−10 to 10)
2. An individual POSITIVITY SCORE for every review (−10 to 10) — for reviews with no text, derive from star rating (5★=+8, 4★=+4, 3★=0, 2★=−4, 1★=−8)
3. An individual ANGER FLAG (true/false) for every review — for reviews with no text, use false

The reviewScores and angerFlags arrays MUST each have exactly ${batch.length} entries, one per review in order.

Scale: −10=extremely negative, 0=neutral, +10=extremely positive

Anger = true: caps/outbursts, personal attacks, hyperbole with no actionable complaint, punitive tone
Anger = false: specific complaints, calm language, suggestions, balanced even if 1 star

Reviews:
${reviewsText}

Respond ONLY with valid JSON, no markdown:
{"score": <number>, "reviewScores": [<${batch.length} numbers>], "angerFlags": [<${batch.length} booleans>]}`;

      const { text: rawText } = await generateText({
        model: gateway(modelId),
        prompt,
        maxOutputTokens: 1024,
      });

      let batchScore: number | null = null;
      let reviewScores: number[] = [];
      let angerFlags: boolean[] = [];

      // Strip markdown fences the model sometimes wraps around JSON
      const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

      try {
        const parsed = JSON.parse(cleaned) as {
          score: number;
          reviewScores: unknown[];
          angerFlags?: unknown[];
        };
        batchScore = typeof parsed.score === "number" ? parsed.score : null;
        reviewScores = Array.isArray(parsed.reviewScores)
          ? (parsed.reviewScores as number[])
          : [];
        angerFlags = Array.isArray(parsed.angerFlags)
          ? (parsed.angerFlags as boolean[])
          : [];
      } catch {
        // Regex fallback — extract the first number as the batch score
        const match = cleaned.match(/-?\d+(?:\.\d+)?/);
        if (match) batchScore = parseFloat(match[0]);
        console.error(`Failed to parse positivity response for batch starting at ${batchStart}:`, rawText);
        // reviewScores/angerFlags stay empty; padScores fills from star ratings
      }

      // Deterministically fill any missing/mismatched entries
      const filledScores = padScores(reviewScores, batch);
      const filledFlags = padAngerFlags(angerFlags, batch.length);

      // Use first batch score as the overall business score
      if (overallScore === null && batchScore !== null) {
        overallScore = Math.max(-10, Math.min(10, batchScore));
      }

      await ctx.runMutation(internal.reviews.setReviewPositivityScores, {
        entries: filledScores.map((s, i) => ({
          reviewId: batch[i]!._id,
          score: Math.max(-10, Math.min(10, s)),
        })),
      });

      await ctx.runMutation(internal.reviews.setReviewAngerFlags, {
        entries: filledFlags.map((isAngry, i) => ({
          reviewId: batch[i]!._id,
          isAngry,
        })),
      });
    }

    if (overallScore !== null) {
      await ctx.runMutation(internal.businessMetrics.setPositivityScore, {
        businessId: args.businessId,
        score: overallScore,
      });
    }
  },
});
