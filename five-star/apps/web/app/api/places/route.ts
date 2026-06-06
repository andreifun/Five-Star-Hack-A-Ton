import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn("SERPAPI_API_KEY not configured");
    return NextResponse.json([]);
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("api_key", apiKey);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  } catch (err) {
    console.error("SerpAPI fetch failed:", err);
    return NextResponse.json([]);
  }

  if (!resp.ok) {
    console.error("SerpAPI error:", resp.status);
    return NextResponse.json([]);
  }

  const data = (await resp.json()) as {
    local_results?: Array<{
      title?: string;
      address?: string;
      // SerpAPI data_id is the hex CID used by the scraping pipeline
      data_id?: string;
      place_id?: string;
      reviews_link?: string;
    }>;
  };

  const results = (data.local_results ?? [])
    .slice(0, 3)
    .filter((r) => r.title && (r.data_id ?? r.place_id ?? r.reviews_link))
    .map((r) => {
      // Prefer data_id — it's the hex CID that setupBusiness.ts extracts via
      // the !1s(0x...) regex and uses for the SerpAPI place + reviews lookup.
      let mapsUrl: string;
      if (r.data_id) {
        const encoded = encodeURIComponent(r.title ?? "");
        mapsUrl = `https://www.google.com/maps/place/${encoded}/data=!1s${r.data_id}`;
      } else if (r.place_id) {
        mapsUrl = `https://www.google.com/maps/place/?q=place_id:${r.place_id}`;
      } else {
        mapsUrl = r.reviews_link!;
      }
      return { name: r.title!, address: r.address ?? "", mapsUrl };
    });

  return NextResponse.json(results);
}
