import { createOpenAI } from "@ai-sdk/openai"

// Vercel AI Gateway routes requests through Vercel's infrastructure,
// providing unified observability, caching, and rate limiting.
export const gateway = createOpenAI({
  baseURL: process.env.AI_GATEWAY_BASE_URL ?? "https://gateway.ai.vercel.app/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
})
