/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner",
  issuer: "test",
  tokenIdentifier: "test|setup-owner",
}

async function seed() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      clerkId: "owner",
      tokenIdentifier: ownerIdentity.tokenIdentifier,
    })
    const otherOwnerId = await ctx.db.insert("users", {
      clerkId: "other",
      tokenIdentifier: "test|setup-other",
    })
    const businessId = await ctx.db.insert("businesses", {
      ownerId,
      name: "Live Bistro",
      type: "restaurant",
      website: "https://example.com",
      phone: "+40 123",
      socialLinks: { google: "https://maps.google.com/example" },
      isActive: true,
    })
    const otherBusinessId = await ctx.db.insert("businesses", {
      ownerId: otherOwnerId,
      name: "Other",
      type: "cafe",
      isActive: true,
    })
    await ctx.db.insert("setupTasks", {
      businessId,
      type: "fetch_google",
      label: "Importing Google profile",
      status: "running",
      order: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    await ctx.db.insert("setupTasks", {
      businessId,
      type: "fetch_website",
      label: "Scanning your website",
      status: "skipped",
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    await ctx.db.insert("reviews", {
      businessId,
      source: "google",
      rating: 5,
      reviewDate: 1,
      isPublic: true,
    })
    await ctx.db.insert("products", {
      businessId,
      name: "Soup",
      isAvailable: true,
      isSignatureDish: false,
    })
    await ctx.db.insert("tips", {
      businessId,
      category: "service",
      priority: "medium",
      title: "Improve service",
      content: "Follow up faster",
      status: "pending",
    })
    return { businessId, otherBusinessId }
  })
  return { owner: t.withIdentity(ownerIdentity), ...ids }
}

describe("setup overview", () => {
  test("returns ordered live discoveries and skipped task states", async () => {
    const { owner, businessId } = await seed()
    const overview = await owner.query(api.setupTasks.getOverview, { businessId })

    expect(overview?.tasks.map((task) => task.order)).toEqual([0, 1])
    expect(overview?.tasks[0]?.status).toBe("skipped")
    expect(overview?.discoveries).toMatchObject({
      connectedSources: ["website", "google"],
      reviewCount: 1,
      reviewsBySource: { google: 1 },
      productCount: 1,
      tipCount: 1,
    })
    expect(overview?.profile.phone).toBe("+40 123")
  })

  test("enforces business ownership", async () => {
    const { owner, otherBusinessId } = await seed()
    await expect(
      owner.query(api.setupTasks.getOverview, { businessId: otherBusinessId }),
    ).rejects.toThrow("Forbidden")
  })
})
