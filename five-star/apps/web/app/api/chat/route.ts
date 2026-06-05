import { streamText, convertToModelMessages } from "ai"
import { auth } from "@clerk/nextjs/server"
import { gateway } from "@/lib/ai"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response("Unauthorized", { status: 401 })

  const { messages } = await req.json()

  const result = streamText({
    model: gateway("anthropic/claude-sonnet-4.6"),
    system: "You are a helpful assistant. Use markdown freely.",
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
