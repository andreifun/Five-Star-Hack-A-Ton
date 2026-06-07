"use node";

import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";

const gateway = createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY });

export const run = action({
  args: {
    businessId: v.id("businesses"),
    tipId: v.id("tips"),
    reportId: v.id("researchReports"),
    query: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [tip, report] = await Promise.all([
      ctx.runQuery(api.tips.getById, { tipId: args.tipId }),
      ctx.runQuery(api.researchReports.getById, { reportId: args.reportId }),
    ]);
    if (!tip || tip.businessId !== args.businessId || !report || report.tipId !== args.tipId) {
      throw new Error("Research report not found");
    }
    await ctx.runMutation(internal.researchReports.setResult, { reportId: args.reportId, status: "running" });
    try {
      const apiKey = process.env.SERPAPI_API_KEY;
      if (!apiKey) throw new Error("SERPAPI_API_KEY is not configured");
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google");
      url.searchParams.set("q", args.query);
      url.searchParams.set("api_key", apiKey);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`SerpAPI request failed (${response.status})`);
      const data = await response.json() as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
      const sources = (data.organic_results ?? []).slice(0, 6).flatMap((item) =>
        item.title && item.link ? [{ title: item.title, url: item.link, snippet: item.snippet }] : [],
      );
      const sourceText = sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.snippet ?? ""}\n${source.url}`).join("\n\n");
      const { text } = await generateText({
        model: gateway(args.model ?? "anthropic/claude-sonnet-4.6"),
        system: "Write a concise, practical research report. Cite claims with bracketed source numbers such as [1]. Use only the supplied sources.",
        prompt: `Tip: ${tip.title}\nContext: ${tip.content}\nResearch query: ${args.query}\n\nSources:\n${sourceText}`,
        maxOutputTokens: 1400,
      });
      await ctx.runMutation(internal.researchReports.setResult, {
        reportId: args.reportId,
        status: "completed",
        sources,
        summary: text,
      });
      return { reportId: args.reportId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed";
      await ctx.runMutation(internal.researchReports.setResult, { reportId: args.reportId, status: "failed", error: message });
      throw error;
    }
  },
});
