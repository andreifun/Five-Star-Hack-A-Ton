"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

export const searchPlaces = action({
  args: { query: v.string() },
  handler: async (_ctx, args): Promise<Array<{ name: string; address: string; mapsUrl: string }>> => {
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) {
      console.warn("SERPAPI_API_KEY not configured — place search unavailable");
      return [];
    }

    const params = new URLSearchParams({
      engine: "google_maps",
      type: "search",
      q: args.query,
      api_key: serpApiKey,
    });

    let resp: Response;
    try {
      resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      return [];
    }

    if (!resp.ok) return [];

    const data = (await resp.json()) as {
      local_results?: Array<{ title?: string; address?: string; link?: string }>;
    };

    return (data.local_results ?? [])
      .slice(0, 3)
      .filter((r) => r.title && r.link)
      .map((r) => ({ name: r.title!, address: r.address ?? "", mapsUrl: r.link! }));
  },
});
