import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.error("[places] SERPAPI_API_KEY not set");
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
    console.error("[places] fetch error:", err);
    return NextResponse.json([]);
  }

  if (!resp.ok) {
    const body = await resp.text();
    console.error("[places] SerpAPI HTTP error:", resp.status, body);
    return NextResponse.json([]);
  }

  const data = await resp.json() as Record<string, unknown>;

  // Log the top-level keys and first result so we can see the real shape
  console.log("[places] SerpAPI response keys:", Object.keys(data));
  const localResults = data.local_results as Array<Record<string, unknown>> | undefined;
  if (localResults?.length) {
    console.log("[places] first result sample:", JSON.stringify(localResults[0], null, 2));
  } else {
    console.log("[places] no local_results — full response:", JSON.stringify(data, null, 2));
  }

  if (!localResults?.length) {
    return NextResponse.json([]);
  }

  const results = localResults.slice(0, 3).map((r) => {
    const name = (r.title as string | undefined) ?? "";
    const address = (r.address as string | undefined) ?? "";
    const dataId = (r.data_id as string | undefined) ?? "";
    const placeId = (r.place_id as string | undefined) ?? "";
    const reviewsLink = (r.reviews_link as string | undefined) ?? "";
    const placeIdSearch = (r.place_id_search as string | undefined) ?? "";

    let mapsUrl = "";
    if (dataId) {
      mapsUrl = `https://www.google.com/maps/place/${encodeURIComponent(name)}/data=!1s${dataId}`;
    } else if (placeId) {
      mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    } else if (reviewsLink) {
      mapsUrl = reviewsLink;
    } else if (placeIdSearch) {
      mapsUrl = placeIdSearch;
    }

    return { name, address, mapsUrl, dataId };
  }).filter((r) => r.name && r.mapsUrl);

  console.log("[places] returning", results.length, "results");
  return NextResponse.json(results);
}
