"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { Streamdown } from "streamdown"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCurrentBusiness } from "@/components/business-context"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2, ArrowUp } from "lucide-react"

export default function ChatPage() {
  const { businessId } = useCurrentBusiness()
  const createThread = useMutation(api.chatThreads.create)
  const sendMessage = useAction(api.ai.chat.sendMessage)

  const [threadId, setThreadId] = useState<Id<"chatThreads"> | null>(null)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const creatingRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load (or lazily create) a default thread for this business.
  const threads = useQuery(api.chatThreads.listByBusiness, {
    businessId,
    paginationOpts: { numItems: 1, cursor: null },
  })

  useEffect(() => {
    if (threadId || threads === undefined) return
    const existing = threads.page[0]
    if (existing) {
      setThreadId(existing._id)
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    createThread({ businessId }).then((id) => setThreadId(id))
  }, [threads, threadId, businessId, createThread])

  const messages = useQuery(
    api.chatMessages.listByThread,
    threadId
      ? { threadId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  async function submit() {
    const text = input.trim()
    if (!text || isSending || !threadId) return
    setInput("")
    setIsSending(true)
    try {
      await sendMessage({ threadId, businessId, content: text })
    } finally {
      setIsSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const visibleMessages =
    messages?.page.filter((m) => m.role !== "system") ?? []
  const isReady = threadId !== null && messages !== undefined

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {!isReady && (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {isReady && visibleMessages.length === 0 && !isSending && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Ask anything about your reviews, ratings, or how to improve.
              </p>
            </div>
          )}

          {visibleMessages.map((msg) => (
            <div
              key={msg._id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role === "user" ? (
                <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {msg.content}
                </div>
              ) : (
                <div
                  className={cn(
                    "min-w-0 max-w-[85%] text-sm",
                    msg.isError && "text-destructive",
                  )}
                >
                  <Streamdown>{msg.content}</Streamdown>
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="flex gap-1 px-1 py-2">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t px-4 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message your assistant…"
            rows={1}
            className="resize-none overflow-hidden"
            disabled={!isReady || isSending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!isReady || isSending || !input.trim()}
            className="shrink-0"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </main>
  )
}
