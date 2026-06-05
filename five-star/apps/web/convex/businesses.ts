import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireBusinessOwner, requireCurrentUser } from "./helpers";
import { internal } from "./_generated/api";

const businessTypeValidator = v.union(
  v.literal("hotel"),
  v.literal("restaurant"),
  v.literal("cafe"),
  v.literal("bar"),
);

const priceRangeValidator = v.union(
  v.literal("budget"),
  v.literal("mid"),
  v.literal("upscale"),
  v.literal("luxury"),
);

export const create = mutation({
  args: {
    name: v.string(),
    type: businessTypeValidator,
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    openingHours: v.optional(v.string()),
    priceRange: v.optional(priceRangeValidator),
    cuisineTypes: v.optional(v.array(v.string())),
    starRating: v.optional(v.number()),
    capacity: v.optional(v.number()),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        facebook: v.optional(v.string()),
        tripadvisor: v.optional(v.string()),
        google: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const businessId = await ctx.db.insert("businesses", {
      ownerId: user._id,
      name: args.name,
      type: args.type,
      description: args.description,
      address: args.address,
      city: args.city,
      country: args.country,
      latitude: args.latitude,
      longitude: args.longitude,
      website: args.website,
      phone: args.phone,
      openingHours: args.openingHours,
      priceRange: args.priceRange,
      cuisineTypes: args.cuisineTypes,
      starRating: args.starRating,
      capacity: args.capacity,
      socialLinks: args.socialLinks,
      isActive: true,
    });

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

    return businessId;
  },
});

export const update = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    openingHours: v.optional(v.string()),
    priceRange: v.optional(priceRangeValidator),
    cuisineTypes: v.optional(v.array(v.string())),
    starRating: v.optional(v.number()),
    capacity: v.optional(v.number()),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        facebook: v.optional(v.string()),
        tripadvisor: v.optional(v.string()),
        google: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { businessId, ...fields } = args;
    await requireBusinessOwner(ctx, businessId);
    await ctx.db.patch(businessId, fields);
  },
});

export const remove = mutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    await ctx.db.patch(args.businessId, { isActive: false });
  },
});

export const listByCurrentUser = query({
  args: {
    paginationOpts: paginationOptsValidator,
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.includeInactive) {
      return await ctx.db
        .query("businesses")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("businesses")
      .withIndex("by_ownerId_and_isActive", (q) =>
        q.eq("ownerId", user._id).eq("isActive", true),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getById = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const { business } = await requireBusinessOwner(ctx, args.businessId);
    const metrics = await ctx.db
      .query("businessMetrics")
      .withIndex("by_businessId", (q) =>
        q.eq("businessId", args.businessId),
      )
      .unique();
    return { ...business, metrics };
  },
});
