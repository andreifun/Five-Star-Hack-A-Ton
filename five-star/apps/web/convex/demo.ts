import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./helpers";

const SETUP_TASKS = [
  ["classify_location", "Classifying location"],
  ["fetch_website", "Scanning your website"],
  ["fetch_google", "Importing Google profile"],
  ["fetch_booking", "Importing Booking.com reviews"],
  ["generate_tips", "Generating improvement tips"],
  ["finalize", "Finalizing setup"],
] as const;

function omitFields<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): Omit<T, K> {
  const copy = { ...source };
  for (const key of keys) delete copy[key];
  return copy;
}

function getTemplateId(ctx: { db: { normalizeId: (table: "businesses", id: string) => Id<"businesses"> | null } }) {
  const configuredId = process.env.DEMO_TEMPLATE_BUSINESS_ID?.trim();
  if (!configuredId) {
    throw new Error(
      "Demo mode is not configured. Set DEMO_TEMPLATE_BUSINESS_ID in the Convex environment.",
    );
  }
  const templateId = ctx.db.normalizeId("businesses", configuredId);
  if (!templateId) throw new Error("DEMO_TEMPLATE_BUSINESS_ID is not a valid business ID.");
  return templateId;
}

export const getTemplatePreview = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    let templateId: Id<"businesses">;
    try {
      templateId = getTemplateId(ctx);
    } catch (error) {
      return {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Demo mode is not configured.",
      };
    }
    const template = await ctx.db.get(templateId);
    if (!template || !template.isActive) {
      return {
        status: "error" as const,
        message: "The configured demo template business is missing or inactive.",
      };
    }
    return {
      status: "ready" as const,
      name: template.name,
      type: template.type,
      description: template.description,
      address: template.address,
      city: template.city,
      country: template.country,
      website: template.website ?? template.mapsWebsite,
      numberOfEmployees: template.numberOfEmployees,
      location: template.location,
      seasonality: template.seasonality,
    };
  },
});

export const prepare = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const templateId = getTemplateId(ctx);
    const template = await ctx.db.get(templateId);
    if (!template || !template.isActive) {
      throw new Error("The configured demo template business is missing or inactive.");
    }

    const previousBusinesses = await ctx.db
      .query("businesses")
      .withIndex("by_ownerId_and_isActive", (q) =>
        q.eq("ownerId", user._id).eq("isActive", true),
      )
      .collect();
    for (const business of previousBusinesses) {
      if (!business.isDemo) continue;
      await ctx.db.patch(business._id, { isActive: false });
      await ctx.scheduler.runAfter(0, internal.demo.cleanupBusiness, {
        businessId: business._id,
        phase: "chatMessages",
      });
    }

    const businessFields = omitFields(
      template,
      "_id",
      "_creationTime",
      "ownerId",
      "isActive",
      "isDemo",
      "demoSourceBusinessId",
    );
    const businessId = await ctx.db.insert("businesses", {
      ...businessFields,
      ownerId: user._id,
      isActive: true,
      isDemo: true,
      demoSourceBusinessId: templateId,
    });

    const sourceReviews = await ctx.db
      .query("reviews")
      .withIndex("by_businessId_and_reviewDate", (q) => q.eq("businessId", templateId))
      .order("desc")
      .take(100);
    const reviewIds = new Map<Id<"reviews">, Id<"reviews">>();
    for (const source of sourceReviews) {
      const fields = omitFields(source, "_id", "_creationTime", "businessId");
      const clonedId = await ctx.db.insert("reviews", { ...fields, businessId });
      reviewIds.set(source._id, clonedId);
    }

    const sourceProducts = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", templateId))
      .take(50);
    for (const source of sourceProducts) {
      const fields = omitFields(source, "_id", "_creationTime", "businessId");
      await ctx.db.insert("products", { ...fields, businessId });
    }

    const sourceTips = await ctx.db
      .query("tips")
      .withIndex("by_businessId", (q) => q.eq("businessId", templateId))
      .take(100);
    for (const source of sourceTips) {
      const fields = omitFields(source, "_id", "_creationTime", "businessId", "sourceReviewIds");
      const clonedSourceReviewIds = source.sourceReviewIds
        ?.map((id) => reviewIds.get(id))
        .filter((id): id is Id<"reviews"> => id !== undefined);
      await ctx.db.insert("tips", {
        ...fields,
        businessId,
        sourceReviewIds: clonedSourceReviewIds?.length ? clonedSourceReviewIds : undefined,
      });
    }

    const sourceMetrics = await ctx.db
      .query("businessMetrics")
      .withIndex("by_businessId", (q) => q.eq("businessId", templateId))
      .unique();
    if (sourceMetrics) {
      const fields = omitFields(sourceMetrics, "_id", "_creationTime", "businessId");
      await ctx.db.insert("businessMetrics", { ...fields, businessId });
    } else {
      await ctx.db.insert("businessMetrics", {
        businessId,
        avgRating: 0,
        reviewCount: 0,
        ratingDistribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
        reviewCountBySource: {},
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        topTopics: [],
        pendingTipsCount: 0,
        inProgressTipsCount: 0,
        completedTipsCount: 0,
        lastComputedAt: Date.now(),
      });
    }

    const now = Date.now();
    for (let order = 0; order < SETUP_TASKS.length; order++) {
      const [type, label] = SETUP_TASKS[order]!;
      await ctx.db.insert("setupTasks", {
        businessId,
        type,
        label,
        status: "completed",
        order,
        createdAt: now,
        updatedAt: now,
      });
    }

    return businessId;
  },
});

const cleanupPhase = v.union(
  v.literal("chatMessages"),
  v.literal("agentTodos"),
  v.literal("researchReports"),
  v.literal("emailDrafts"),
  v.literal("chatThreads"),
  v.literal("setupTasks"),
  v.literal("tips"),
  v.literal("reviews"),
  v.literal("products"),
  v.literal("businessMetrics"),
  v.literal("business"),
);

const PHASES = [
  "chatMessages",
  "agentTodos",
  "researchReports",
  "emailDrafts",
  "chatThreads",
  "setupTasks",
  "tips",
  "reviews",
  "products",
  "businessMetrics",
  "business",
] as const;

export const cleanupBusiness = internalMutation({
  args: { businessId: v.id("businesses"), phase: cleanupPhase },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business || business.isActive || !business.isDemo) return;

    if (args.phase === "business") {
      await ctx.db.delete(args.businessId);
      return;
    }

    const rows = await ctx.db
      .query(args.phase)
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);

    const currentIndex = PHASES.indexOf(args.phase);
    const nextPhase = rows.length === 100 ? args.phase : PHASES[currentIndex + 1]!;
    await ctx.scheduler.runAfter(0, internal.demo.cleanupBusiness, {
      businessId: args.businessId,
      phase: nextPhase,
    });
  },
});
