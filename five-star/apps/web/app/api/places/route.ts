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
    console.error("SerpAPI error:", resp.status, await resp.text());
    return NextResponse.json([]);
  }

  const data = (await resp.json()) as {
    local_results?: Array<{
      title?: string;
      address?: string;
      data_id?: string;
    }>;
  };

  const results = (data.local_results ?? [])
    .slice(0, 3)
    .filter((r): r is { title: string; address?: string; data_id: string } =>
      !!(r.title && r.data_id),
    )
    .map((r) => ({
      name: r.title,
      address: r.address ?? "",
      mapsUrl: `https://www.google.com/maps/place/${encodeURIComponent(r.title)}/data=!1s${r.data_id}`,
      dataId: r.data_id,
    }));

  return NextResponse.json(results);
}
