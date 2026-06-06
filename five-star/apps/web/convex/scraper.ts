"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaceResult {
  name: string;
  address: string;
  mapsUrl: string;
  dataId: string;
}

export interface ScrapeResult {
  mapsUrl: string;
  websiteUrl: string;
  menuPages: string[];
  menuImages: string[];
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function safelyFetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 20000);
  } catch {
    return "";
  }
}

// ─── Link extraction ──────────────────────────────────────────────────────────

function scoreLink(href: string, text: string): number {
  const combined = (href + " " + text).toLowerCase();
  let score = 0;
  if (/menu|meniu/.test(combined)) score += 5;
  if (/delivery|livrare|order|comanda|food|mancare|carta|preturi|prices/.test(combined)) score += 3;
  if (/restaurant|eat|drink|bar|bistro/.test(combined)) score += 2;
  return score;
}

function extractLinks(
  html: string,
  pageUrl: string,
  startHostname: string,
): Array<{ url: string; score: number }> {
  const linkRegex = /<a[^>]+href=["']([^"'#?][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const skipExts =
    /\.(css|js|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico|xml|json)(\?|$)/i;
  const seen = new Set<string>();
  const results: Array<{ url: string; score: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const rawHref = m[1]!.trim();
    const linkText = m[2]!.replace(/<[^>]+>/g, "").trim();
    let absUrl: string;
    try {
      absUrl = new URL(rawHref, pageUrl).href;
    } catch {
      continue;
    }
    if (!absUrl.startsWith("http")) continue;
    if (skipExts.test(absUrl)) continue;
    if (seen.has(absUrl)) continue;
    seen.add(absUrl);

    const isSameDomain = new URL(absUrl).hostname === startHostname;
    const score = scoreLink(absUrl, linkText);
    if (!isSameDomain && score < 3) continue;
    results.push({ url: absUrl, score });
  }
  return results;
}

// ─── Menu signal detection ────────────────────────────────────────────────────

function extractMenuImageUrls(html: string, pageUrl: string): string[] {
  const menuKeywords = /menu|meniu|carta|food|dish|drink|preturi|prices/i;
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1]!;
    const tag = m[0]!;
    if (menuKeywords.test(src) || menuKeywords.test(tag)) {
      try {
        candidates.push(new URL(src, pageUrl).href);
      } catch {
        /* skip */
      }
    }
  }
  return candidates.slice(0, 10);
}

function pageHasMenuSignal(html: string): boolean {
  return /menu|meniu|preturi|prices/i.test(html);
}

// ─── Website crawler ──────────────────────────────────────────────────────────

async function crawlForMenuUrls(
  startUrl: string,
): Promise<{ menuPages: string[]; menuImages: string[] }> {
  const MAX_PAGES = 20;
  const MAX_DEPTH = 2;

  let startHostname: string;
  try {
    startHostname = new URL(startUrl).hostname;
  } catch {
    return { menuPages: [], menuImages: [] };
  }

  const visited = new Set<string>();
  const menuPages: string[] = [];
  const menuImages: string[] = [];
  const queue: Array<{ url: string; depth: number; score: number }> = [
    { url: startUrl, depth: 0, score: 10 },
  ];

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    queue.sort((a, b) => b.score - a.score);
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);

    const html = await safelyFetchUrl(item.url);
    if (!html) continue;

    if (pageHasMenuSignal(html)) {
      if (!menuPages.includes(item.url)) menuPages.push(item.url);
      const imgs = extractMenuImageUrls(html, item.url);
      for (const img of imgs) {
        if (!menuImages.includes(img)) menuImages.push(img);
      }
    }

    if (item.depth < MAX_DEPTH) {
      const links = extractLinks(html, item.url, startHostname);
      for (const link of links) {
        if (!visited.has(link.url)) {
          queue.push({ url: link.url, depth: item.depth + 1, score: link.score });
        }
      }
    }
  }

  return { menuPages, menuImages };
}

// ─── SerpAPI helpers ──────────────────────────────────────────────────────────

async function searchGoogleMaps(
  query: string,
  serpApiKey: string,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q: query,
    api_key: serpApiKey,
  });

  const resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return [];

  const data = (await resp.json()) as {
    local_results?: Array<{
      title?: string;
      address?: string;
      data_id?: string;
      place_id?: string;
    }>;
  };

  return (data.local_results ?? [])
    .slice(0, 3)
    .filter((r) => r.title && r.data_id)
    .map((r) => {
      const dataId = r.data_id!;
      const name = encodeURIComponent(r.title ?? "");
      return {
        name: r.title!,
        address: r.address ?? "",
        mapsUrl: `https://www.google.com/maps/place/${name}/data=!1s${dataId}`,
        dataId,
      };
    });
}

async function fetchPlaceWebsite(
  dataId: string,
  serpApiKey: string,
): Promise<{ website?: string; address?: string; phone?: string }> {
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "place",
    data: `!4m2!3m1!1s${dataId}`,
    api_key: serpApiKey,
  });

  try {
    const resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return {};

    const data = (await resp.json()) as {
      place_results?: {
        website?: string;
        address?: string;
        phone?: string;
        links?: { website?: string };
      };
    };

    const pr = data.place_results;
    return {
      website: pr?.website ?? pr?.links?.website,
      address: pr?.address,
      phone: pr?.phone,
    };
  } catch {
    return {};
  }
}

// ─── Public action ────────────────────────────────────────────────────────────

export const searchAndScrapeMenu = action({
  args: { businessName: v.string() },
  handler: async (_ctx, args): Promise<ScrapeResult & { candidates: PlaceResult[] }> => {
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) {
      throw new Error(
        "SERPAPI_API_KEY is not configured. Set it in your Convex environment variables.",
      );
    }

    // 1. Search Google Maps for matching places
    const candidates = await searchGoogleMaps(args.businessName, serpApiKey);
    if (candidates.length === 0) {
      return { mapsUrl: "", websiteUrl: "", menuPages: [], menuImages: [], candidates: [] };
    }

    // Use the top result (callers can inspect `candidates` to let the user choose)
    const top = candidates[0]!;

    // 2. Fetch place details to get the website URL
    const placeDetails = await fetchPlaceWebsite(top.dataId, serpApiKey);
    const websiteUrl = placeDetails.website ?? "";

    // 3. Crawl the website for menu pages and images
    const { menuPages, menuImages } = websiteUrl
      ? await crawlForMenuUrls(websiteUrl)
      : { menuPages: [], menuImages: [] };

    return {
      mapsUrl: top.mapsUrl,
      websiteUrl,
      menuPages,
      menuImages,
      candidates, // all 3 results so the caller can present a selection UI
    };
  },
});
