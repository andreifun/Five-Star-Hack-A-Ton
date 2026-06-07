"use client"

import type { Doc } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CATEGORY_LABELS, PRIORITY_BADGE } from "@/lib/format"
import { Loader2, Play } from "lucide-react"

export function TipsKanbanCard({
  tip,
  onStart,
  onOpen,
  starting = false,
}: {
  tip: Doc<"tips">
  onStart?: () => void
  onOpen?: () => void
  starting?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Badge variant={PRIORITY_BADGE[tip.priority]}>{tip.priority}</Badge>
        <Badge variant="outline">{CATEGORY_LABELS[tip.category]}</Badge>
      </div>
      <p className="mt-2.5 text-sm font-medium">{tip.title}</p>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">· {tip.content}</p>
      {tip.status === "pending" && onStart ? (
        <Button
          size="sm"
          className="mt-4 w-full"
          disabled={starting}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onStart()
          }}
        >
          {starting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          {starting ? "Starting…" : "Start"}
        </Button>
      ) : null}
      {onOpen ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full md:hidden"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          Open
        </Button>
      ) : null}
    </div>
  )
}
