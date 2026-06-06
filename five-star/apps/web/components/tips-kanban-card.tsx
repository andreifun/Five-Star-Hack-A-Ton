"use client"

import { Badge } from "@workspace/ui/components/badge"
import { CATEGORY_LABELS, PRIORITY_BADGE } from "@/lib/format"

export type MockAction = {
  id: string
  text: string
}

export type MockTip = {
  id: string
  title: string
  priority: "high" | "medium" | "low"
  category: keyof typeof CATEGORY_LABELS
  status: "pending" | "in_progress" | "done" | "dismissed"
  actions: MockAction[]
}

export function TipsKanbanCard({ tip }: { tip: MockTip }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Badge variant={PRIORITY_BADGE[tip.priority]}>{tip.priority}</Badge>
        <Badge variant="outline">{CATEGORY_LABELS[tip.category]}</Badge>
      </div>
      <p className="mt-2.5 text-sm font-medium">{tip.title}</p>
      {tip.actions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tip.actions.map((action) => (
            <li key={action.id} className="text-sm text-muted-foreground">
              · {action.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
