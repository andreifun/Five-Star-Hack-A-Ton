import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkId", ["clerkId"]),

  businesses: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    type: v.union(
      v.literal("hotel"),
      v.literal("restaurant"),
      v.literal("cafe"),
      v.literal("bar"),
    ),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    website: v.optional(v.string()),
    mapsWebsite: v.optional(v.string()),
    phone: v.optional(v.string()),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        facebook: v.optional(v.string()),
        tripadvisor: v.optional(v.string()),
        google: v.optional(v.string()),
        booking: v.optional(v.string()),
        yelp: v.optional(v.string()),
      }),
    ),
    openingHours: v.optional(v.string()),
    priceRange: v.optional(
      v.union(
        v.literal("budget"),
        v.literal("mid"),
        v.literal("upscale"),
        v.literal("luxury"),
      ),
    ),
    cuisineTypes: v.optional(v.array(v.string())),
    starRating: v.optional(v.number()),
    capacity: v.optional(v.number()),
    numberOfEmployees: v.optional(v.number()),
    turnover: v.optional(v.string()),
    location: v.optional(v.string()),
    locationType: v.optional(v.union(v.literal("rural"), v.literal("urban"))),
    seasonality: v.optional(v.union(v.literal("all_year"), v.literal("seasonal"))),
    isActive: v.boolean(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_isActive", ["ownerId", "isActive"]),

  reviews: defineTable({
    businessId: v.id("businesses"),
    source: v.union(
      v.literal("google"),
      v.literal("tripadvisor"),
      v.literal("manual"),
      v.literal("booking"),
      v.literal("yelp"),
      v.literal("other"),
    ),
    externalId: v.optional(v.string()),
    rating: v.number(),
    title: v.optional(v.string()),
    text: v.optional(v.string()),
    hasText: v.optional(v.boolean()),
    reviewerName: v.optional(v.string()),
    reviewerAvatarUrl: v.optional(v.string()),
    reviewDate: v.number(),
    language: v.optional(v.string()),
    sentiment: v.optional(
      v.union(
        v.literal("positive"),
        v.literal("neutral"),
        v.literal("negative"),
      ),
    ),
    sentimentScore: v.optional(v.number()),
    topics: v.optional(v.array(v.string())),
    ownerReply: v.optional(v.string()),
    isPublic: v.boolean(),
  })
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_source", ["businessId", "source"])
    .index("by_businessId_and_reviewDate", ["businessId", "reviewDate"])
    .index("by_businessId_and_rating", ["businessId", "rating"])
    .index("by_businessId_and_sentiment", ["businessId", "sentiment"])
    .index("by_businessId_and_hasText", ["businessId", "hasText"])
    .index("by_businessId_and_hasText_and_reviewDate", ["businessId", "hasText", "reviewDate"])
    .index("by_businessId_and_externalId", ["businessId", "externalId"])
    .index("by_businessId_and_source_and_hasText_and_reviewDate", ["businessId", "source", "hasText", "reviewDate"])
    .index("by_businessId_and_sentiment_and_hasText_and_reviewDate", ["businessId", "sentiment", "hasText", "reviewDate"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["businessId", "source"],
    }),

  products: defineTable({
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
    imageStorageId: v.optional(v.id("_storage")),
  })
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_isAvailable", ["businessId", "isAvailable"])
    .index("by_businessId_and_category", ["businessId", "category"]),

  tips: defineTable({
    businessId: v.id("businesses"),
    category: v.union(
      v.literal("service"),
      v.literal("ambiance"),
      v.literal("menu"),
      v.literal("cleanliness"),
      v.literal("value"),
      v.literal("communication"),
      v.literal("operations"),
      v.literal("marketing"),
      v.literal("staff"),
      v.literal("other"),
    ),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    title: v.string(),
    content: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("dismissed"),
    ),
    sourceReviewIds: v.optional(v.array(v.id("reviews"))),
    generatedByModel: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_status", ["businessId", "status"])
    .index("by_businessId_and_category", ["businessId", "category"])
    .index("by_businessId_and_priority_and_status", [
      "businessId",
      "priority",
      "status",
    ]),

  businessMetrics: defineTable({
    businessId: v.id("businesses"),
    avgRating: v.number(),
    reviewCount: v.number(),
    ratingDistribution: v.object({
      one: v.number(),
      two: v.number(),
      three: v.number(),
      four: v.number(),
      five: v.number(),
    }),
    reviewCountBySource: v.record(v.string(), v.number()),
    sentimentBreakdown: v.object({
      positive: v.number(),
      neutral: v.number(),
      negative: v.number(),
    }),
    topTopics: v.array(v.string()),
    positivityScore: v.optional(v.number()),
    pendingTipsCount: v.number(),
    inProgressTipsCount: v.number(),
    completedTipsCount: v.number(),
    lastReviewDate: v.optional(v.number()),
    lastComputedAt: v.number(),
  }).index("by_businessId", ["businessId"]),

  chatThreads: defineTable({
    businessId: v.id("businesses"),
    title: v.string(),
    isArchived: v.boolean(),
    lastMessageAt: v.optional(v.number()),
    messageCount: v.number(),
    context: v.optional(v.string()),
  })
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_isArchived", ["businessId", "isArchived"])
    .index("by_businessId_and_lastMessageAt", ["businessId", "lastMessageAt"]),

  setupTasks: defineTable({
    businessId: v.id("businesses"),
    type: v.union(
      v.literal("classify_location"),
      v.literal("fetch_website"),
      v.literal("fetch_google"),
      v.literal("fetch_tripadvisor"),
      v.literal("fetch_booking"),
      v.literal("fetch_yelp"),
      v.literal("discover_products"),
      v.literal("generate_tips"),
      v.literal("finalize"),
    ),
    label: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    message: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_businessId", ["businessId"]),

  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    businessId: v.id("businesses"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    model: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    referencedTipIds: v.optional(v.array(v.id("tips"))),
    referencedReviewIds: v.optional(v.array(v.id("reviews"))),
    isError: v.boolean(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_threadId", ["threadId"])
    .index("by_threadId_and_role", ["threadId", "role"])
    .index("by_businessId", ["businessId"]),
});
