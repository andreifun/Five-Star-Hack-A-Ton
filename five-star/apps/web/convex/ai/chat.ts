"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { getAiGateway } from "./env";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";

export const sendMessage = action({
  args: {
    threadId: v.id("chatThreads"),
    businessId: v.id("businesses"),
    content: v.string(),
    model: v.optional(v.string()),
    kickoff: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args: {
      threadId: Id<"chatThreads">;
      businessId: Id<"businesses">;
      content: string;
      model?: string;
      kickoff?: boolean;
    },
  ): Promise<{ content: string; messageId: Id<"chatMessages">; isError: boolean }> => {
    const modelId = args.model ?? "anthropic/claude-sonnet-4-5";
    const gateway = getAiGateway();

    const businessWithMetrics = (await ctx.runQuery(api.businesses.getById, {
      businessId: args.businessId,
    })) as ({ metrics: Doc<"businessMetrics"> | null } & Doc<"businesses">) | null;

    if (!businessWithMetrics) throw new Error("Business not found or access denied");

    const thread = (await ctx.runQuery(api.chatThreads.getById, {
      threadId: args.threadId,
    })) as Doc<"chatThreads"> | null;

    if (!thread || thread.businessId !== args.businessId) {
      throw new Error("Thread not found or does not belong to this business");
    }

    if (args.kickoff && !thread.tipId) throw new Error("Kickoff requires a tip thread");

    if (!args.kickoff) {
      await ctx.runMutation(internal.chatMessages.addMessage, {
        threadId: args.threadId,
        businessId: args.businessId,
        role: "user",
        content: args.content,
        isError: false,
      });
    }

    const [history, recentReviewsPage, pendingTipsPage] = await Promise.all([
      ctx.runQuery(internal.chatMessages.getRecentForContext, {
        threadId: args.threadId,
        limit: 20,
      }) as Promise<Doc<"chatMessages">[]>,
      ctx.runQuery(api.reviews.listByBusiness, {
        businessId: args.businessId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ctx.runQuery(api.tips.listByBusiness, {
        businessId: args.businessId,
        paginationOpts: { numItems: 10, cursor: null },
        status: "pending",
      }),
    ]);

    const metrics = businessWithMetrics.metrics;
    const recentReviews = (recentReviewsPage as { page: Doc<"reviews">[] }).page;
    const pendingTips = (pendingTipsPage as { page: Doc<"tips">[] }).page;
    const tipWorkspace = thread.tipId
      ? await ctx.runQuery(api.tips.getWorkspace, { tipId: thread.tipId }) as { sourceReviews: Doc<"reviews">[] } | null
      : null;
    const sourceReviews = tipWorkspace?.sourceReviews ?? [];

    const systemPrompt = `You are an expert hospitality consultant and business intelligence assistant for ${businessWithMetrics.name}, a ${businessWithMetrics.type} business. You help the owner deeply understand customer feedback, identify trends, and take action.

Business Profile:
- Name: ${businessWithMetrics.name}
- Type: ${businessWithMetrics.type}
- Location: ${[businessWithMetrics.city, businessWithMetrics.country].filter(Boolean).join(", ") || "Not specified"}
- Description: ${businessWithMetrics.description || "Not provided"}
- Price range: ${businessWithMetrics.priceRange || "Not specified"}
${businessWithMetrics.cuisineTypes?.length ? `- Cuisine: ${businessWithMetrics.cuisineTypes.join(", ")}` : ""}
${businessWithMetrics.starRating ? `- Star rating: ${businessWithMetrics.starRating}` : ""}
${businessWithMetrics.capacity ? `- Capacity: ${businessWithMetrics.capacity} guests` : ""}

Current Performance:
- Average rating: ${metrics?.avgRating.toFixed(2) ?? "N/A"} / 5 from ${metrics?.reviewCount ?? 0} reviews
- Sentiment: ${metrics ? `${metrics.sentimentBreakdown.positive} positive, ${metrics.sentimentBreakdown.neutral} neutral, ${metrics.sentimentBreakdown.negative} negative` : "N/A"}
- Positivity score: ${metrics?.positivityScore?.toFixed(1) ?? "N/A"} (scale: −10 very bad → +10 excellent)
- Top review topics: ${metrics?.topTopics.slice(0, 8).join(", ") || "None yet"}
- Open improvement tips: ${metrics?.pendingTipsCount ?? 0}

${thread.tipId ? `Active Tip Workspace:
- Title: ${thread.title}
- Context: ${thread.context ?? "No additional context"}
- Keep the conversation focused on executing this tip unless the user asks otherwise.
- Source reviews attached to this tip:
${sourceReviews.length > 0 ? sourceReviews.map((r) => `  - [${r.rating}★ ${r.source}] ${r.text ?? "(no text)"}`).join("\n") : "  - None attached"}
` : ""}

Recent Reviews (last 10):
${recentReviews.length > 0 ? recentReviews.map((r: Doc<"reviews">) => `[${r.rating}★ ${r.sentiment ?? ""} · ${r.source}] ${r.text ?? "(no text)"}`).join("\n") : "No reviews yet."}

Pending Improvement Tips:
${pendingTips.length > 0 ? pendingTips.map((t: Doc<"tips">) => `[${t.priority}] ${t.title}: ${t.content}`).join("\n") : "No pending tips."}

## Instructions
- Use your tools proactively. If the user asks about specific topics, sentiment, or ratings — search for those reviews rather than guessing.
- When you identify a concrete action the owner should take, create a todo item for them using create_todo.
- When current external information would help execute the active tip, run research and save the cited report.
- When the user asks for an email, draft and save it. Never send email yourself; the owner must explicitly approve the final draft first.
- Reference specific review data in your analysis.
- Be direct, specific, and practical. Keep responses concise.`;
    const kickoffInstructions = args.kickoff
      ? `\n\n## Mandatory kickoff workflow
- Before responding, call run_research at least once with a focused query relevant to the active tip.
- Inspect relevant reviews using search_reviews or get_low_rated_reviews when useful.
- Create a practical ordered action plan by calling create_todo for each concrete task. Create 3-7 todos unless the issue genuinely needs fewer.
- After tool calls, summarize the evidence, research findings, and execution plan.`
      : "";

    const messages: { role: "user" | "assistant"; content: string }[] = history
      .filter((m: Doc<"chatMessages">) => m.role === "user" || m.role === "assistant")
      .map((m: Doc<"chatMessages">) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    if (args.kickoff) messages.push({ role: "user", content: args.content });

    let assistantContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let isError = false;
    let errorMessage: string | undefined;

    try {
      const result = await generateText({
        model: gateway(modelId),
        system: systemPrompt + kickoffInstructions,
        messages,
        maxOutputTokens: 2048,
        stopWhen: stepCountIs(args.kickoff ? 12 : 5),
        tools: {
          search_reviews: tool({
            description:
              "Search and filter customer reviews by text, sentiment, rating, or source platform. Use this to find specific feedback patterns or validate claims about the business.",
            inputSchema: jsonSchema<{
              query?: string;
              sentiment?: "positive" | "neutral" | "negative";
              source?: "google" | "tripadvisor" | "booking" | "yelp" | "manual" | "other";
              minRating?: number;
              maxRating?: number;
              limit?: number;
            }>({
              type: "object",
              properties: {
                query: { type: "string", description: "Text to search in review content" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"], description: "Filter by review sentiment" },
                source: { type: "string", enum: ["google", "tripadvisor", "booking", "yelp", "manual", "other"], description: "Filter by review platform" },
                minRating: { type: "number", minimum: 1, maximum: 5, description: "Minimum star rating" },
                maxRating: { type: "number", minimum: 1, maximum: 5, description: "Maximum star rating" },
                limit: { type: "number", minimum: 1, maximum: 20, description: "How many reviews to return (default 10)" },
              },
            }),
            execute: async ({ query, sentiment, source, minRating, maxRating, limit }) => {
              const reviews = await ctx.runQuery(internal.reviews.searchForAgent, {
                businessId: args.businessId,
                searchQuery: query,
                sentiment,
                source,
                minRating,
                maxRating,
                limit: limit ?? 10,
              });
              return { reviews, count: reviews.length };
            },
          }),

          get_low_rated_reviews: tool({
            description:
              "Fetch the most recent low-rated reviews to understand what customers complain about. Good for diagnosing recurring problems.",
            inputSchema: jsonSchema<{ maxRating?: number; limit?: number }>({
              type: "object",
              properties: {
                maxRating: { type: "number", minimum: 1, maximum: 3, description: "Maximum rating to include (default: 2)" },
                limit: { type: "number", minimum: 1, maximum: 20, description: "How many reviews to return" },
              },
            }),
            execute: async ({ maxRating, limit }) => {
              const reviews = await ctx.runQuery(internal.reviews.searchForAgent, {
                businessId: args.businessId,
                maxRating: maxRating ?? 2,
                limit: limit ?? 10,
              });
              return { reviews, count: reviews.length };
            },
          }),

          get_tips: tool({
            description:
              "Retrieve improvement tips. Check what recommendations have been generated and their completion status.",
            inputSchema: jsonSchema<{
              status?: "pending" | "in_progress" | "done" | "dismissed";
              limit?: number;
            }>({
              type: "object",
              properties: {
                status: { type: "string", enum: ["pending", "in_progress", "done", "dismissed"], description: "Filter by status" },
                limit: { type: "number", minimum: 1, maximum: 30 },
              },
            }),
            execute: async ({ status, limit }) => {
              const tipsPage = await ctx.runQuery(api.tips.listByBusiness, {
                businessId: args.businessId,
                paginationOpts: { numItems: limit ?? 20, cursor: null },
                status,
              });
              const tips = (tipsPage as { page: Doc<"tips">[] }).page;
              return {
                tips: tips.map((t) => ({
                  title: t.title,
                  category: t.category,
                  priority: t.priority,
                  status: t.status,
                  content: t.content,
                })),
                count: tips.length,
              };
            },
          }),

          create_todo: tool({
            description:
              "Create a persisted action item for the active tip. Use this whenever you identify a specific, concrete task the owner should do.",
            inputSchema: jsonSchema<{
              title: string;
              description: string;
              priority: "high" | "medium" | "low";
            }>({
              type: "object",
              required: ["title", "description", "priority"],
              properties: {
                title: { type: "string", description: "Short, actionable title (e.g. 'Address slow service complaints')" },
                description: { type: "string", description: "Detailed explanation: what to do, why it matters, and suggested steps. Be specific." },
                priority: { type: "string", enum: ["high", "medium", "low"], description: "Impact-based priority" },
              },
            }),
            execute: async ({ title, description, priority }) => {
              const id = await ctx.runMutation(internal.agentTodos.create, {
                businessId: args.businessId,
                threadId: args.threadId,
                tipId: thread.tipId,
                title,
                description,
                priority,
              });
              return { success: true, todoId: id, created: title };
            },
          }),

          run_research: tool({
            description:
              "Research current external information with web search, save a cited report for the active tip, and show it in the conversation. Use only when the thread belongs to a tip.",
            inputSchema: jsonSchema<{ query: string }>({
              type: "object",
              required: ["query"],
              properties: {
                query: { type: "string", description: "Focused web research query" },
              },
            }),
            execute: async ({ query }) => {
              if (!thread.tipId) return { success: false, error: "This conversation is not attached to a tip." };
              const reportId = await ctx.runMutation(api.researchReports.create, {
                businessId: args.businessId,
                tipId: thread.tipId,
                query,
              });
              await ctx.runAction(api.ai.research.run, {
                businessId: args.businessId,
                tipId: thread.tipId,
                reportId,
                query,
                model: modelId,
              });
              return { success: true, reportId, query };
            },
          }),

          draft_email: tool({
            description:
              "Draft and save an email for the active tip. The owner will review and explicitly approve the final recipients, subject, and body before it can be sent.",
            inputSchema: jsonSchema<{
              recipients: string[];
              instructions: string;
            }>({
              type: "object",
              required: ["recipients", "instructions"],
              properties: {
                recipients: {
                  type: "array",
                  items: { type: "string" },
                  description: "Final recipient email addresses supplied by the user",
                },
                instructions: { type: "string", description: "Purpose, tone, and content for the email" },
              },
            }),
            execute: async ({ recipients, instructions }) => {
              if (!thread.tipId) return { success: false, error: "This conversation is not attached to a tip." };
              const drafted = await ctx.runAction(api.ai.email.draft, {
                businessId: args.businessId,
                tipId: thread.tipId,
                instructions,
                model: modelId,
              });
              const draftId = await ctx.runMutation(api.emailDrafts.create, {
                businessId: args.businessId,
                tipId: thread.tipId,
                recipients,
                subject: drafted.subject,
                body: drafted.body,
              });
              return { success: true, draftId, subject: drafted.subject };
            },
          }),
        },
      });

      assistantContent = result.text;
      inputTokens = result.usage.inputTokens ?? 0;
      outputTokens = result.usage.outputTokens ?? 0;
    } catch (err) {
      isError = true;
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      assistantContent =
        "I encountered an error processing your request. Please try again.";
    }

    const messageId: Id<"chatMessages"> = await ctx.runMutation(
      internal.chatMessages.addMessage,
      {
        threadId: args.threadId,
        businessId: args.businessId,
        role: "assistant",
        content: assistantContent,
        model: modelId,
        inputTokens,
        outputTokens,
        isError,
        errorMessage,
      },
    );

    if (args.kickoff) {
      await ctx.runMutation(internal.chatThreads.finishKickoff, {
        threadId: args.threadId,
        status: isError ? "failed" : "completed",
        error: errorMessage,
      });
    }

    return { content: assistantContent, messageId, isError };
  },
});
