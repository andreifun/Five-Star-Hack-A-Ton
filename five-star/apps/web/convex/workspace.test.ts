/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const identity = {
  subject: "owner",
  issuer: "test",
  tokenIdentifier: "test|owner",
}

async function seed() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: "owner",
      tokenIdentifier: identity.tokenIdentifier,
    })
    const businessId = await ctx.db.insert("businesses", {
      ownerId: userId,
      name: "Test",
      type: "restaurant",
      isActive: true,
    })
    const otherUserId = await ctx.db.insert("users", {
      clerkId: "other",
      tokenIdentifier: "test|other",
    })
    const otherBusinessId = await ctx.db.insert("businesses", {
      ownerId: otherUserId,
      name: "Other",
      type: "cafe",
      isActive: true,
    })
    const tipId = await ctx.db.insert("tips", {
      businessId,
      category: "service",
      priority: "high",
      title: "Improve service",
      content: "Respond faster",
      status: "pending",
    })
    return { businessId, otherBusinessId, tipId }
  })
  return { t, owner: t.withIdentity(identity), ...ids }
}

afterEach(() => vi.restoreAllMocks())

describe("tip workspace backend", () => {
  test("enforces ownership and persists tip status transitions", async () => {
    const { t, owner, tipId } = await seed()
    await owner.mutation(api.tips.updateStatus, {
      tipId,
      status: "in_progress",
    })
    expect((await owner.query(api.tips.getById, { tipId }))?.status).toBe(
      "in_progress"
    )
    await expect(
      t
        .withIdentity({ ...identity, tokenIdentifier: "test|other" })
        .mutation(api.tips.updateStatus, { tipId, status: "done" })
    ).rejects.toThrow("Forbidden")
  })

  test("uses one thread per tip and scopes todos and reports", async () => {
    const { owner, businessId, tipId } = await seed()
    const first = await owner.mutation(api.chatThreads.getOrCreateForTip, {
      businessId,
      tipId,
    })
    const second = await owner.mutation(api.chatThreads.getOrCreateForTip, {
      businessId,
      tipId,
    })
    expect(second).toBe(first)
    await owner.run(async (ctx) => {
      await ctx.db.patch(tipId, {
        title: "Updated issue",
        content: "Use the updated issue context",
      })
    })
    await owner.mutation(api.chatThreads.getOrCreateForTip, {
      businessId,
      tipId,
    })
    expect(
      await owner.query(api.chatThreads.getById, { threadId: first })
    ).toMatchObject({
      title: "Updated issue",
      context: "Use the updated issue context",
    })
    expect(
      await owner.mutation(api.chatThreads.claimKickoff, { threadId: first })
    ).toBe(true)
    expect(
      await owner.mutation(api.chatThreads.claimKickoff, { threadId: first })
    ).toBe(false)
    await owner.mutation(internal.chatThreads.finishKickoff, {
      threadId: first,
      status: "completed",
    })
    expect(
      await owner.mutation(api.chatThreads.claimKickoff, { threadId: first })
    ).toBe(false)
    await owner.mutation(api.agentTodos.createForTip, {
      businessId,
      tipId,
      threadId: first,
      title: "Call team",
      description: "Schedule a meeting",
      priority: "medium",
    })
    const todos = await owner.query(api.agentTodos.listByThread, {
      businessId,
      threadId: first,
    })
    expect(todos).toHaveLength(1)
    await owner.mutation(internal.agentTodos.completeFromAgent, {
      businessId,
      threadId: first,
      id: todos[0]!._id,
    })
    expect(
      (
        await owner.query(api.agentTodos.listByThread, {
          businessId,
          threadId: first,
        })
      )[0]?.isCompleted
    ).toBe(true)
    const reportId = await owner.mutation(api.researchReports.create, {
      businessId,
      tipId,
      query: "service training",
    })
    await owner.mutation(internal.researchReports.setResult, {
      reportId,
      status: "completed",
      summary: "Use role-play exercises [1].",
      sources: [{ title: "Training guide", url: "https://example.com/guide" }],
    })
    expect(
      await owner.query(api.researchReports.listByTip, { businessId, tipId })
    ).toMatchObject([
      {
        query: "service training",
        status: "completed",
        summary: "Use role-play exercises [1].",
        sources: [{ url: "https://example.com/guide" }],
      },
    ])
  })

  test("requires explicit approval and records mocked Resend delivery", async () => {
    const { owner, businessId, tipId } = await seed()
    const draftId = await owner.mutation(api.emailDrafts.create, {
      businessId,
      tipId,
      recipients: ["owner@example.com"],
      subject: "Plan",
      body: "Hello",
    })
    await expect(owner.action(api.ai.email.send, { draftId })).rejects.toThrow(
      "explicitly approved"
    )
    await owner.mutation(api.emailDrafts.approve, {
      draftId,
      recipients: ["owner@example.com"],
      subject: "Plan",
      body: "Hello",
    })
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("EMAIL_FROM", "test@example.com")
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: "email_123" }), { status: 200 })
        )
    )
    await owner.action(api.ai.email.send, { draftId })
    expect(
      await owner.query(api.emailDrafts.getById, { draftId })
    ).toMatchObject({ status: "sent", providerId: "email_123" })
  })
})
