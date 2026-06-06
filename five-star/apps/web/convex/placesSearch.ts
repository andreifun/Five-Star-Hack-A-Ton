"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getOptionalSerpApiKey } from "./ai/env";

export const searchPlaces = action({
  args: { query: v.string() },
  handler: async (_ctx, args): Promise<Array<{ name: string; address: string; mapsUrl: string }>> => {
    const serpApiKey = getOptionalSerpApiKey();
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
      local_results?: Array<{
        title?: string;
        address?: string;
        place_id?: string;
        reviews_link?: string;
        place_id_search?: string;
      }>;
    };

    return (data.local_results ?? [])
      .slice(0, 3)
      .filter((r) => r.title)
      .map((r) => {
        const mapsUrl = r.place_id
          ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}`
          : (r.reviews_link ?? r.place_id_search ?? "");
        return { name: r.title!, address: r.address ?? "", mapsUrl };
      })
      .filter((r) => r.mapsUrl !== "");
  },
});
