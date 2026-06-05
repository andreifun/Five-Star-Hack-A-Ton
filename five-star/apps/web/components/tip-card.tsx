"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Check, Play, X, RotateCcw } from "lucide-react"
import { CATEGORY_LABELS, PRIORITY_BADGE } from "@/lib/format"

type TipStatus = Doc<"tips">["status"]

export function TipCard({ tip }: { tip: Doc<"tips"> }) {
  const updateStatus = useMutation(api.tips.updateStatus)
  const [pending, setPending] = useState(false)

  async function setStatus(status: TipStatus) {
    setPending(true)
    try {
      await updateStatus({ tipId: tip._id, status })
    } finally {
      setPending(false)
    }
  }

  const isClosed = tip.status === "done" || tip.status === "dismissed"

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={PRIORITY_BADGE[tip.priority]}>{tip.priority}</Badge>
          <Badge variant="outline">{CATEGORY_LABELS[tip.category]}</Badge>
        </div>
        {tip.status === "done" && (
          <Badge variant="secondary">
            <Check className="size-3" /> Done
          </Badge>
        )}
        {tip.status === "in_progress" && (
          <Badge variant="default">In progress</Badge>
        )}
        {tip.status === "dismissed" && (
          <Badge variant="outline">Dismissed</Badge>
        )}
      </div>

      <p className="mt-2.5 text-sm font-medium">{tip.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tip.content}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {!isClosed && tip.status !== "in_progress" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setStatus("in_progress")}
          >
            <Play className="size-3.5" /> Start
          </Button>
        )}
        {!isClosed && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => setStatus("done")}
          >
            <Check className="size-3.5" /> Mark done
          </Button>
        )}
        {!isClosed && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setStatus("dismissed")}
          >
            <X className="size-3.5" /> Dismiss
          </Button>
        )}
        {isClosed && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setStatus("pending")}
          >
            <RotateCcw className="size-3.5" /> Reopen
          </Button>
        )}
      </div>
    </div>
  )
}
