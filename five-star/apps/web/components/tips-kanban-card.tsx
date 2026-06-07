"use client"

import type { Doc } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { CATEGORY_LABELS, PRIORITY_BADGE } from "@/lib/format"

export function TipsKanbanCard({ tip }: { tip: Doc<"tips"> }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Badge variant={PRIORITY_BADGE[tip.priority]}>{tip.priority}</Badge>
        <Badge variant="outline">{CATEGORY_LABELS[tip.category]}</Badge>
      </div>
      <p className="mt-2.5 text-sm font-medium">{tip.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">· {tip.content}</p>
    </div>
  )
}
