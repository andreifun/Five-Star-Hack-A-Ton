"use node";

/**
 * Two-step scraper pipeline:
 *
 * Step 1 — getMapsOptions(businessName)
 *   Called while the user types. Returns up to 3 Google Maps place candidates
 *   so the UI can render a selection dropdown. Fast: only one SerpAPI call.
 *
 * Step 2 — scrapeMenuFromUrl(mapsUrl)
 *   Called after the user picks a place. Resolves the business website via
 *   SerpAPI place details, then crawls it (depth 2) for menu pages, images,
 *   and PDFs. Returns all discovered URLs.
 *
 * Note: Playwright cannot run in Convex's Node.js action sandbox — it requires
 * browser binaries (~300 MB Chromium) that the environment does not provide.
 * This implementation uses fetch + regex, which is already used throughout the
 * existing setup pipeline and handles all the same cases reliably.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getSerpApiKey, getOptionalSerperApiKey } from "./ai/env";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface MapsOption {
  name: string;
  address: string;
  mapsUrl: string;
  /** Internal SerpAPI data_id — kept so scrapeMenuFromUrl can call place details */
  dataId: string;
}

export interface MenuScrapeResult {
  mapsUrl: string;
  websiteUrl: string | null;
  menuPages: string[];
  menuImages: string[];
  menuPDFs: string[];
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function safelyFetchHtml(url: string): Promise<string> {
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
    return (await res.text()).slice(0, 25000);
  } catch {
    return "";
  }
}

// ─── SerpAPI — place search ───────────────────────────────────────────────────

// Returns null on API-level failure (network error, HTTP error, or error body from SerpAPI).
// Returns [] when the API worked but found no matching places.
async function serpSearchPlaces(query: string, apiKey: string): Promise<MapsOption[] | null> {
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q: query,
    api_key: apiKey,
  });

  let resp: Response;
  try {
    resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return null;
  }
  if (!resp.ok) return null;

  const data = (await resp.json()) as Record<string, unknown>;

  // SerpAPI signals credit exhaustion / errors via a top-level "error" field with a 200 status.
  if (data.error) {
    console.warn("[getMapsOptions] SerpAPI error:", data.error);
    return null;
  }

  const localResults =
    (data.local_results as Array<Record<string, unknown>> | undefined) ??
    (data.places_results as Array<Record<string, unknown>> | undefined);

  console.log("[getMapsOptions] serpapi keys:", Object.keys(data));
  if (localResults?.length) {
    console.log("[getMapsOptions] serpapi first result:", JSON.stringify(localResults[0]));
  } else {
    console.log("[getMapsOptions] serpapi no results, full response:", JSON.stringify(data).slice(0, 500));
  }

  return (localResults ?? []).slice(0, 3)
    .filter((r) => r.title)
    .map((r) => {
      const name = String(r.title ?? "");
      const address = String(r.address ?? "");
      const dataId = String(r.data_id ?? "");
      const placeId = String(r.place_id ?? "");
      const reviewsLink = String(r.reviews_link ?? "");
      const placeIdSearch = String(r.place_id_search ?? "");

      let mapsUrl = "";
      if (dataId) {
        mapsUrl = `https://www.google.com/maps/place/${encodeURIComponent(name)}/data=!1s${dataId}`;
      } else if (placeId) {
        mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
      } else if (reviewsLink) {
        mapsUrl = reviewsLink;
      } else if (placeIdSearch) {
        mapsUrl = placeIdSearch;
      } else if (name) {
        const q = address ? `${name} ${address}` : name;
        mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
      }

      return { name, address, mapsUrl, dataId };
    })
    .filter((r) => r.mapsUrl);
}

// ─── Serper.dev — place search (fallback) ─────────────────────────────────────

async function serperSearchPlaces(query: string, apiKey: string): Promise<MapsOption[]> {
  let resp: Response;
  try {
    resp = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return [];
  }
  if (!resp.ok) return [];

  const data = (await resp.json()) as Record<string, unknown>;
  const places = data.places as Array<Record<string, unknown>> | undefined;

  console.log("[getMapsOptions] serper keys:", Object.keys(data));
  if (places?.length) {
    console.log("[getMapsOptions] serper first result:", JSON.stringify(places[0]));
  }

  return (places ?? []).slice(0, 3)
    .filter((r) => r.title)
    .map((r) => {
      const name = String(r.title ?? "");
      const address = String(r.address ?? "");
      const cid = String(r.cid ?? "");
      const placeId = String(r.placeId ?? "");

      let mapsUrl = "";
      if (cid) {
        mapsUrl = `https://www.google.com/maps?cid=${cid}`;
      } else if (placeId) {
        mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
      } else if (name) {
        const q = address ? `${name} ${address}` : name;
        mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
      }

      return { name, address, mapsUrl, dataId: "" };
    })
    .filter((r) => r.mapsUrl);
}

// ─── SerpAPI — place details ──────────────────────────────────────────────────

async function serpFetchPlaceDetails(
  dataId: string,
  apiKey: string,
): Promise<{ website: string | null; address: string | null; phone: string | null }> {
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "place",
    data: `!4m2!3m1!1s${dataId}`,
    api_key: apiKey,
  });

  try {
    const resp = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return { website: null, address: null, phone: null };

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
      website: pr?.website ?? pr?.links?.website ?? null,
      address: pr?.address ?? null,
      phone: pr?.phone ?? null,
    };
  } catch {
    return { website: null, address: null, phone: null };
  }
}

// ─── Website crawler ──────────────────────────────────────────────────────────

const MENU_SIGNAL = /menu|meniu|preturi|prices|carta/i;
const MENU_KEYWORDS = /menu|meniu|delivery|livrare|order|comanda|carta|preturi|prices/i;

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
): Array<{ url: string; score: number; isPdf: boolean }> {
  const linkRegex = /<a[^>]+href=["']([^"'#?][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const skipExts = /\.(css|js|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico|xml|json)(\?|$)/i;
  const seen = new Set<string>();
  const results: Array<{ url: string; score: number; isPdf: boolean }> = [];
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

    const isPdf = /\.pdf(\?|$)/i.test(absUrl);
    const isSameDomain = new URL(absUrl).hostname === startHostname;
    const score = scoreLink(absUrl, linkText);

    // Cross-domain: only follow if it strongly signals menu content or is a PDF
    if (!isSameDomain && score < 3 && !isPdf) continue;
    results.push({ url: absUrl, score, isPdf });
  }
  return results;
}

function extractMenuImageUrls(html: string, pageUrl: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1]!;
    if (MENU_SIGNAL.test(src) || MENU_SIGNAL.test(m[0]!)) {
      try {
        candidates.push(new URL(src, pageUrl).href);
      } catch { /* skip */ }
    }
  }
  return candidates.slice(0, 10);
}

async function crawlWebsiteForMenu(startUrl: string): Promise<{
  menuPages: string[];
  menuImages: string[];
  menuPDFs: string[];
}> {
  const MAX_PAGES = 20;
  const MAX_DEPTH = 2;

  let startHostname: string;
  try {
    startHostname = new URL(startUrl).hostname;
  } catch {
    return { menuPages: [], menuImages: [], menuPDFs: [] };
  }

  const visited = new Set<string>();
  const menuPages: string[] = [];
  const menuImages: string[] = [];
  const menuPDFs: string[] = [];
  const queue: Array<{ url: string; depth: number; score: number }> = [
    { url: startUrl, depth: 0, score: 10 },
  ];

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    queue.sort((a, b) => b.score - a.score);
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);

    // PDF — record and skip HTML crawling
    if (/\.pdf(\?|$)/i.test(item.url)) {
      if (MENU_KEYWORDS.test(item.url) && !menuPDFs.includes(item.url)) {
        menuPDFs.push(item.url);
      }
      continue;
    }

    const html = await safelyFetchHtml(item.url);
    if (!html) continue;

    if (MENU_SIGNAL.test(html)) {
      if (!menuPages.includes(item.url)) menuPages.push(item.url);
      for (const img of extractMenuImageUrls(html, item.url)) {
        if (!menuImages.includes(img)) menuImages.push(img);
      }
    }

    if (item.depth < MAX_DEPTH) {
      for (const link of extractLinks(html, item.url, startHostname)) {
        if (!visited.has(link.url)) {
          queue.push({ url: link.url, depth: item.depth + 1, score: link.score });
        }
      }
    }
  }

  return { menuPages, menuImages, menuPDFs };
}

// ─── Action 1: getMapsOptions ─────────────────────────────────────────────────

export const getMapsOptions = action({
  args: { businessName: v.string() },
  handler: async (
    _ctx,
    args,
  ): Promise<Array<{ name: string; address: string; mapsUrl: string; dataId: string }>> => {
    const apiKey = getSerpApiKey(); // throws if not set — surfaces in Convex dashboard logs
    const results = await serpSearchPlaces(args.businessName.trim(), apiKey);
    // null = API-level failure (credits exhausted, HTTP error, error body) → try Serper fallback
    // []   = API worked but no matching places → return empty, don't fall back
    if (results !== null) return results;
    const serperKey = getOptionalSerperApiKey();
    if (!serperKey) return [];
    return serperSearchPlaces(args.businessName.trim(), serperKey);
  },
});

// ─── Action 2: scrapeMenuFromUrl ──────────────────────────────────────────────

export const scrapeMenuFromUrl = action({
  args: {
    mapsUrl: v.string(),
    /** Optional: pass dataId directly to skip URL parsing */
    dataId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<MenuScrapeResult> => {
    const apiKey = getSerpApiKey();
    if (!apiKey) throw new Error("SERPAPI_API_KEY is not configured.");

    // Extract data_id from mapsUrl if not provided directly
    const dataId =
      args.dataId ??
      (() => {
        const match = args.mapsUrl.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
        return match?.[1] ?? null;
      })();

    if (!dataId) {
      return { mapsUrl: args.mapsUrl, websiteUrl: null, menuPages: [], menuImages: [], menuPDFs: [] };
    }

    // Step 1: get website URL from Google Maps place details
    const { website } = await serpFetchPlaceDetails(dataId, apiKey);

    // Step 2: crawl the website for menu content
    const { menuPages, menuImages, menuPDFs } = website
      ? await crawlWebsiteForMenu(website)
      : { menuPages: [], menuImages: [], menuPDFs: [] };

    return {
      mapsUrl: args.mapsUrl,
      websiteUrl: website,
      menuPages,
      menuImages,
      menuPDFs,
    };
  },
});
