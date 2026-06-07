"use client"

import { useEffect, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { Streamdown } from "streamdown"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { PromptBar } from "@/components/prompt-bar"
import { ConversationArtifacts } from "@/components/conversation-artifacts"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2, MessageCircle } from "lucide-react"

export function TipConversation({ businessId, tipId }: { businessId: Id<"businesses">; tipId: Id<"tips"> }) {
  const getThread = useMutation(api.chatThreads.getOrCreateForTip)
  const claimKickoff = useMutation(api.chatThreads.claimKickoff)
  const sendMessage = useAction(api.ai.chat.sendMessage)
  const [threadId, setThreadId] = useState<Id<"chatThreads"> | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getThread({ businessId, tipId }).then(async (id) => {
      setThreadId(id)
      const claimed = await claimKickoff({ threadId: id })
      if (!claimed) return
      setPreparing(true)
      try {
        await sendMessage({
          businessId,
          threadId: id,
          kickoff: true,
          content: `Start executing this tip now. First inspect the relevant customer reviews and business context. Use web research to gather current external information relevant to the issue. Use any other useful tools. Then create a focused, ordered todo list with concrete tasks using create_todo, and finish with a concise summary of what you learned and the recommended execution plan. Do not ask me to prompt you again.`,
        })
      } finally {
        setPreparing(false)
      }
    })
  }, [businessId, claimKickoff, getThread, sendMessage, tipId])
  const messages = useQuery(api.chatMessages.listByThread, threadId ? { threadId, paginationOpts: { numItems: 100, cursor: null } } : "skip")
  const visible = messages?.page.filter((message) => message.role !== "system") ?? []
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, sending])

  async function submit({ model }: { model: string; images: File[] }) {
    if (!threadId || !input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    try { await sendMessage({ businessId, threadId, content, model }) } finally { setSending(false) }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="min-h-[360px] flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {!messages ? <Loader2 className="mx-auto mt-12 size-5 animate-spin text-muted-foreground" /> : null}
          {messages && visible.length === 0 && !preparing ? <div className="py-16 text-center text-sm text-muted-foreground"><MessageCircle className="mx-auto mb-3 size-7 opacity-40" />Ask the assistant to help execute this tip.</div> : null}
          {visible.map((message) => <div key={message._id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>{message.role === "user" ? <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">{message.content}</div> : <div className={cn("max-w-[90%] text-sm", message.isError && "text-destructive")}><Streamdown>{message.content}</Streamdown></div>}</div>)}
          {preparing ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Researching the issue and building the initial action plan…</div> : null}
          {sending ? <div className="text-sm text-muted-foreground">Thinking…</div> : null}
          <ConversationArtifacts businessId={businessId} tipId={tipId} />
          <div ref={bottomRef} />
        </div>
      </div>
      <PromptBar value={input} onChange={setInput} onSubmit={submit} disabled={!threadId || sending || preparing} placeholder="Ask about this tip…" />
    </section>
  )
}
