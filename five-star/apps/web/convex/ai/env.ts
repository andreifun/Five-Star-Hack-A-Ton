"use node";

import { createGatewayProvider } from "@ai-sdk/gateway";

let cachedGatewayProvider:
  | ReturnType<typeof createGatewayProvider>
  | undefined;

export function getAiGateway() {
  if (cachedGatewayProvider) {
    return cachedGatewayProvider;
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not configured. Set it in your Convex project or local environment."
    );
  }

  cachedGatewayProvider = createGatewayProvider({ apiKey });
  return cachedGatewayProvider;
}

export function getSerpApiKey() {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "SERPAPI_API_KEY is not configured. Set it in your Convex project or local environment."
    );
  }
  return apiKey;
}

export function getOptionalSerpApiKey() {
  return process.env.SERPAPI_API_KEY?.trim() || undefined;
}
