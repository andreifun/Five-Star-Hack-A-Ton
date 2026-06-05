"use client"

import { useChat } from "@ai-sdk/react"
import { type TextUIPart } from "ai"
import { useEffect, useRef, useState } from "react"
import { UserButton } from "@clerk/nextjs"
import { Streamdown } from "streamdown"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

export default function Page() {
  const { messages, sendMessage, status } = useChat()
  const isLoading = status === "streaming" || status === "submitted"
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  function submit() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput("")
    sendMessage({ text })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <span className="text-sm font-semibold">five-star</span>
        <UserButton />
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Start a conversation.</p>
            </div>
          )}

          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {messages.map((msg) => {
              const textParts = msg.parts.filter(
                (p): p is TextUIPart => p.type === "text"
              )

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {textParts.map((p, i) => (
                        <span key={i}>{p.text}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="max-w-[85%] min-w-0 text-sm">
                      {textParts.map((p, i) => (
                        <Streamdown
                          key={i}
                          mode={p.state === "streaming" ? "streaming" : "static"}
                        >
                          {p.text}
                        </Streamdown>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {isLoading && messages.at(-1)?.role !== "assistant" && (
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
            onSubmit={(e) => { e.preventDefault(); submit() }}
            className="mx-auto flex max-w-2xl items-end gap-2"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message…"
              rows={1}
              className="resize-none overflow-hidden"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </Button>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </main>
    </div>
  )
}
