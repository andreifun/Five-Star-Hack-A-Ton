"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  ListChecks,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

const DESCRIPTION_PREVIEW_LENGTH = 220

export function ConversationActionList({
  businessId,
  threadId,
}: {
  businessId: Id<"businesses">
  threadId: Id<"chatThreads"> | null
}) {
  const items = useQuery(
    api.agentTodos.listByThread,
    threadId ? { businessId, threadId } : "skip"
  )
  const complete = useMutation(api.agentTodos.complete)
  const remove = useMutation(api.agentTodos.remove)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [mobileOpen, setMobileOpen] = useState(false)
  const openCount = items?.filter((item) => !item.isCompleted).length ?? 0

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border bg-card/95 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur lg:hidden"
        aria-label="Open action list"
      >
        <ListChecks className="size-4" />
        Actions
        <Badge variant="secondary" className="border-0 text-[10px]">
          {openCount}
        </Badge>
      </button>
      <aside
        className={cn(
          "fixed inset-x-3 top-20 bottom-20 z-30 overflow-hidden rounded-2xl border bg-card/95 shadow-lg backdrop-blur-xl lg:absolute lg:top-4 lg:right-4 lg:bottom-24 lg:left-auto lg:z-10 lg:block lg:w-80",
          mobileOpen ? "block" : "hidden"
        )}
      >
        <div className="h-full overflow-y-auto p-4">
          <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2.5 backdrop-blur-xl">
            <ListChecks className="size-4" />
            <h2 className="text-sm font-semibold">Action List</h2>
            <Badge variant="secondary" className="ml-auto border-0 text-[10px]">
              {openCount} open
            </Badge>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Close action list"
            >
              <X className="size-4" />
            </button>
          </div>

          {!items ? (
            <p className="py-4 text-xs text-muted-foreground">
              Loading actions…
            </p>
          ) : null}
          {items?.length === 0 ? (
            <p className="px-2 py-4 text-xs leading-relaxed text-muted-foreground">
              This conversation has no actions yet. Ask the assistant to add the
              next steps.
            </p>
          ) : null}

          <div className="mt-2 space-y-1">
            {items?.map((item) => {
              const isExpanded = expandedIds.has(item._id)
              const isLong =
                item.description.length > DESCRIPTION_PREVIEW_LENGTH

              return (
                <div
                  key={item._id}
                  className="group rounded-xl px-2 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => void complete({ id: item._id })}
                      disabled={item.isCompleted}
                      className="mt-0.5 text-muted-foreground hover:text-foreground disabled:text-emerald-600"
                      aria-label={
                        item.isCompleted ? "Completed" : "Complete action"
                      }
                    >
                      {item.isCompleted ? (
                        <Check className="size-4" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          item.isCompleted
                            ? "text-sm font-medium text-muted-foreground line-through"
                            : "text-sm font-medium"
                        }
                      >
                        {item.title}
                      </p>
                      <p
                        className={
                          isExpanded
                            ? "mt-1.5 text-xs leading-5 whitespace-pre-wrap text-muted-foreground"
                            : "mt-1.5 line-clamp-3 text-xs leading-5 text-muted-foreground"
                        }
                      >
                        {item.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                          {item.priority}
                        </span>
                        {isLong ? (
                          <button
                            onClick={() => toggleExpanded(item._id)}
                            className="flex items-center gap-0.5 text-[11px] font-medium text-foreground/70 hover:text-foreground"
                          >
                            {isExpanded ? (
                              <>
                                Show less <ChevronUp className="size-3" />
                              </>
                            ) : (
                              <>
                                Show more <ChevronDown className="size-3" />
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => void remove({ id: item._id })}
                      className="text-muted-foreground hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
                      aria-label="Delete action"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </aside>
    </>
  )
}
