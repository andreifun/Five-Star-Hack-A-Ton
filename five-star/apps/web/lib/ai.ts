import { createGatewayProvider } from "@ai-sdk/gateway"

export const gateway = createGatewayProvider({
  apiKey: process.env.AI_GATEWAY_API_KEY,
})
