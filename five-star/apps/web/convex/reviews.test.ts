/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const identity = {
  subject: "owner",
  issuer: "test",
  tokenIdentifier: "test|reviews-owner",
}

async function seed() {
  const t = convexTest(schema, modules)
  const businessId = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      clerkId: "owner",
      tokenIdentifier: identity.tokenIdentifier,
    })
    const businessId = await ctx.db.insert("businesses", {
      ownerId,
      name: "Test",
      type: "restaurant",
      isActive: true,
    })
    const reviews = [
      { source: "google" as const, sentimentScore: -10, sentiment: "positive" as const },
      { source: "google" as const, sentimentScore: -3, sentiment: "positive" as const },
      { source: "google" as const, sentimentScore: -2, sentiment: "negative" as const },
      { source: "yelp" as const, sentimentScore: 2, sentiment: "negative" as const },
      { source: "google" as const, sentimentScore: 2.5, sentiment: "negative" as const },
    ]
    for (const [index, review] of reviews.entries()) {
      await ctx.db.insert("reviews", {
        businessId,
        ...review,
        rating: 3,
        hasText: true,
        reviewDate: index,
        isPublic: true,
      })
    }
    return businessId
  })
  return { owner: t.withIdentity(identity), businessId }
}

async function listScores(
  owner: Awaited<ReturnType<typeof seed>>["owner"],
  businessId: Awaited<ReturnType<typeof seed>>["businessId"],
  sentiment: "positive" | "neutral" | "negative",
  source?: "google" | "yelp",
) {
  const result = await owner.query(api.reviews.listByBusiness, {
    businessId,
    paginationOpts: { cursor: null, numItems: 20 },
    sentiment,
    source,
  })
  return result.page.map((review) => review.sentimentScore)
}

describe("review positivity filters", () => {
  test("filters by positivity score instead of the legacy sentiment field", async () => {
    const { owner, businessId } = await seed()

    expect(await listScores(owner, businessId, "negative")).toEqual([-3, -10])
    expect(await listScores(owner, businessId, "neutral")).toEqual([2, -2])
    expect(await listScores(owner, businessId, "positive")).toEqual([2.5])
  })

  test("combines positivity and source filters", async () => {
    const { owner, businessId } = await seed()

    expect(await listScores(owner, businessId, "neutral", "google")).toEqual([-2])
  })
})
