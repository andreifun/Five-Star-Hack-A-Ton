import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireBusinessOwner } from "./helpers";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    isAvailable: v.boolean(),
    sortOrder: v.optional(v.number()),
    capacity: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    allergens: v.optional(v.array(v.string())),
    isSignatureDish: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    return await ctx.db.insert("products", args);
  },
});

export const createInternal = internalMutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    price: v.optional(v.number()),
    isAvailable: v.boolean(),
    isSignatureDish: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("products", args);
  },
});

export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    isAvailable: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    capacity: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    allergens: v.optional(v.array(v.string())),
    isSignatureDish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { productId, ...fields } = args;
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Product not found");
    await requireBusinessOwner(ctx, product.businessId);
    await ctx.db.patch(productId, fields);
  },
});

export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    await requireBusinessOwner(ctx, product.businessId);
    await ctx.db.delete(args.productId);
  },
});

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    onlyAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.category !== undefined) {
      return await ctx.db
        .query("products")
        .withIndex("by_businessId_and_category", (q) =>
          q.eq("businessId", args.businessId).eq("category", args.category!),
        )
        .order("asc")
        .paginate(args.paginationOpts);
    }
    if (args.onlyAvailable) {
      return await ctx.db
        .query("products")
        .withIndex("by_businessId_and_isAvailable", (q) =>
          q.eq("businessId", args.businessId).eq("isAvailable", true),
        )
        .order("asc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", args.businessId))
      .order("asc")
      .paginate(args.paginationOpts);
  },
});

export const reorder = mutation({
  args: {
    businessId: v.id("businesses"),
    orderedIds: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    await requireBusinessOwner(ctx, args.businessId);
    for (let i = 0; i < args.orderedIds.length; i++) {
      const productId = args.orderedIds[i]!;
      const product = await ctx.db.get(productId);
      if (!product || product.businessId !== args.businessId) {
        throw new Error("Product does not belong to this business");
      }
      await ctx.db.patch(productId, { sortOrder: i });
    }
  },
});
