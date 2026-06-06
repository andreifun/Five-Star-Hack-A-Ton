import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_MAPS_API_KEY not configured");
    return NextResponse.json([]);
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    console.error("Places API fetch failed:", err);
    return NextResponse.json([]);
  }

  if (!resp.ok) {
    console.error("Places API error:", resp.status, await resp.text());
    return NextResponse.json([]);
  }

  const data = (await resp.json()) as {
    status: string;
    results?: Array<{
      name?: string;
      formatted_address?: string;
      place_id?: string;
    }>;
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Places API status:", data.status);
  }

  const results = (data.results ?? []).slice(0, 3).map((r) => ({
    name: r.name ?? "",
    address: r.formatted_address ?? "",
    mapsUrl: r.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}`
      : "",
  })).filter((r) => r.name && r.mapsUrl);

  return NextResponse.json(results);
}
