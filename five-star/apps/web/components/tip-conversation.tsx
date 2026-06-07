"use client"

import { useEffect, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { Streamdown } from "streamdown"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { PromptBar } from "@/components/prompt-bar"
import { ConversationArtifacts } from "@/components/conversation-artifacts"
import { ConversationActionList } from "@/components/conversation-action-list"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2, MessageCircle } from "lucide-react"

export function TipConversation({
  businessId,
  tipId,
  autoKickoff,
}: {
  businessId: Id<"businesses">
  tipId: Id<"tips">
  autoKickoff: boolean
}) {
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
      if (!autoKickoff) return
      const claimed = await claimKickoff({ threadId: id })
      if (!claimed) return
      setPreparing(true)
      try {
        await sendMessage({
          businessId,
          threadId: id,
          kickoff: true,
          content: `Start working on the active issue in this conversation. Ground the response in the issue title, issue context, and its source reviews from your system context. Research current external information where useful, build the global Action List with concrete next steps, and finish with a concise issue-specific execution summary. Do not switch to unrelated business topics or ask me to prompt you again.`,
        })
      } finally {
        setPreparing(false)
      }
    })
  }, [autoKickoff, businessId, claimKickoff, getThread, sendMessage, tipId])
  const messages = useQuery(
    api.chatMessages.listByThread,
    threadId
      ? { threadId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip"
  )
  const visible =
    messages?.page.filter((message) => message.role !== "system") ?? []
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  async function submit({ model }: { model: string; images: File[] }) {
    if (!threadId || !input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    try {
      await sendMessage({ businessId, threadId, content, model })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-[360px] min-w-0 flex-1 flex-col lg:pr-80">
        <div className="flex-1 overflow-y-auto px-4 py-5 pt-14 lg:pt-5">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {!messages ? (
              <Loader2 className="mx-auto mt-12 size-5 animate-spin text-muted-foreground" />
            ) : null}
            {messages && visible.length === 0 && !preparing ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <MessageCircle className="mx-auto mb-3 size-7 opacity-40" />
                Ask the assistant to help execute this tip.
              </div>
            ) : null}
            {visible.map((message) => (
              <div
                key={message._id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "user" ? (
                  <div className="overflow-wrap-anywhere max-w-[88%] min-w-0 rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground sm:max-w-[80%]">
                    {message.content}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "overflow-wrap-anywhere max-w-full min-w-0 text-sm sm:max-w-[90%]",
                      message.isError && "text-destructive"
                    )}
                  >
                    <Streamdown>{message.content}</Streamdown>
                  </div>
                )}
              </div>
            ))}
            {preparing ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Researching the issue and building the initial action plan…
              </div>
            ) : null}
            {sending ? (
              <div className="text-sm text-muted-foreground">Thinking…</div>
            ) : null}
            <ConversationArtifacts businessId={businessId} tipId={tipId} />
            <div ref={bottomRef} />
          </div>
        </div>
        <PromptBar
          value={input}
          onChange={setInput}
          onSubmit={submit}
          disabled={!threadId || sending || preparing}
          placeholder="Ask about this issue…"
        />
      </div>
      <ConversationActionList businessId={businessId} threadId={threadId} />
    </section>
  )
}
