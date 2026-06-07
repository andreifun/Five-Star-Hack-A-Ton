/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const presenterIdentity = {
  subject: "presenter",
  issuer: "test",
  tokenIdentifier: "test|presenter",
}

async function seedTemplate() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const presenterId = await ctx.db.insert("users", {
      clerkId: "presenter",
      tokenIdentifier: presenterIdentity.tokenIdentifier,
    })
    const templateId = await ctx.db.insert("businesses", {
      ownerId: presenterId,
      name: "Real Restaurant",
      type: "restaurant",
      description: "A real operating restaurant.",
      city: "Bucharest",
      country: "Romania",
      isActive: true,
    })
    const reviewId = await ctx.db.insert("reviews", {
      businessId: templateId,
      source: "google",
      rating: 2,
      text: "Service was slow.",
      hasText: true,
      reviewerName: "Guest",
      reviewDate: Date.now(),
      sentiment: "negative",
      topics: ["service"],
      isPublic: true,
    })
    await ctx.db.insert("products", {
      businessId: templateId,
      name: "House Special",
      category: "Main",
      isAvailable: true,
      isSignatureDish: true,
    })
    await ctx.db.insert("tips", {
      businessId: templateId,
      category: "service",
      priority: "high",
      title: "Speed up service",
      content: "Review the handoff process.",
      status: "pending",
      sourceReviewIds: [reviewId],
    })
    await ctx.db.insert("businessMetrics", {
      businessId: templateId,
      avgRating: 4.2,
      reviewCount: 42,
      ratingDistribution: { one: 1, two: 2, three: 3, four: 10, five: 26 },
      reviewCountBySource: { google: 42 },
      sentimentBreakdown: { positive: 30, neutral: 7, negative: 5 },
      topTopics: ["service"],
      positivityScore: 6.4,
      pendingTipsCount: 1,
      inProgressTipsCount: 0,
      completedTipsCount: 0,
      lastComputedAt: Date.now(),
    })
    return { presenterId, reviewId, templateId }
  })
  return { t, presenter: t.withIdentity(presenterIdentity), ...ids }
}

afterEach(() => {})

describe("demo workspace", () => {
  test("lists non-demo businesses for selection", async () => {
    const { presenter } = await seedTemplate()

    const templates = await presenter.query(api.demo.listTemplates, {})
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({ name: "Real Restaurant", city: "Bucharest" })
  })

  test("clones a selected business into an isolated functional workspace", async () => {
    const { t, presenter, presenterId, reviewId, templateId } = await seedTemplate()

    const businessId = await presenter.mutation(api.demo.prepare, { businessId: templateId })
    const result = await t.run(async (ctx) => {
      const business = await ctx.db.get(businessId)
      const reviews = await ctx.db.query("reviews").withIndex("by_businessId", (q) => q.eq("businessId", businessId)).collect()
      const products = await ctx.db.query("products").withIndex("by_businessId", (q) => q.eq("businessId", businessId)).collect()
      const tips = await ctx.db.query("tips").withIndex("by_businessId", (q) => q.eq("businessId", businessId)).collect()
      const tasks = await ctx.db.query("setupTasks").withIndex("by_businessId", (q) => q.eq("businessId", businessId)).collect()
      const threads = await ctx.db.query("chatThreads").withIndex("by_businessId", (q) => q.eq("businessId", businessId)).collect()
      return { business, products, reviews, tasks, threads, tips }
    })

    expect(result.business).toMatchObject({
      ownerId: presenterId,
      isActive: true,
      isDemo: true,
      demoSourceBusinessId: templateId,
    })
    expect(result.reviews).toHaveLength(1)
    expect(result.products).toHaveLength(1)
    expect(result.tips).toHaveLength(1)
    expect(result.tips[0]!.sourceReviewIds).toEqual([result.reviews[0]!._id])
    expect(result.tips[0]!.sourceReviewIds).not.toEqual([reviewId])
    expect(result.tasks).toHaveLength(5)
    expect(result.tasks.every((task) => task.status === "completed")).toBe(true)
    expect(result.threads).toHaveLength(0)

    await presenter.mutation(api.tips.updateStatus, {
      tipId: result.tips[0]!._id,
      status: "in_progress",
    })
    const sourceTip = await t.run(async (ctx) =>
      ctx.db.query("tips").withIndex("by_businessId", (q) => q.eq("businessId", templateId)).unique(),
    )
    expect(sourceTip?.status).toBe("pending")
  })

  test("resets the presenter's previous demo workspace", async () => {
    const { t, presenter, templateId } = await seedTemplate()
    const firstId = await presenter.mutation(api.demo.prepare, { businessId: templateId })
    const secondId = await presenter.mutation(api.demo.prepare, { businessId: templateId })

    expect(secondId).not.toBe(firstId)
    const state = await t.run(async (ctx) => ({
      first: await ctx.db.get(firstId),
      second: await ctx.db.get(secondId),
    }))
    expect(state.first?.isActive).toBe(false)
    expect(state.second?.isActive).toBe(true)
  })

  test("does not list demo businesses as selectable templates", async () => {
    const { t, presenter, presenterId, templateId } = await seedTemplate()
    await presenter.mutation(api.demo.prepare, { businessId: templateId })

    const templates = await presenter.query(api.demo.listTemplates, {})
    expect(templates.every((b) => !("isDemo" in b) || !(b as { isDemo?: boolean }).isDemo)).toBe(true)
    expect(templates).toHaveLength(1)
    expect(templates[0]!.name).toBe("Real Restaurant")
  })
})
