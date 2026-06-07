"use client"

import { useMemo, useState } from "react"
import { usePaginatedQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCurrentBusiness } from "@/components/business-context"
import { FeatureCardSummary } from "@/components/feature-card-summary"
import { TipsKanbanBoard } from "@/components/tips-kanban-board"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const { businessId, business } = useCurrentBusiness()
  const [activeOnly, setActiveOnly] = useState(false)
  const tips = usePaginatedQuery(api.tips.listByBusiness, { businessId }, { initialNumItems: 100 })
  const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  const sortedTips = useMemo(
    () => [...tips.results].sort((a, b) => {
      if (a.status !== "pending" || b.status !== "pending") return 0
      return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    }),
    [tips.results],
  )
  if (!business || tips.status === "LoadingFirstPage") return <div className="flex flex-1 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  return <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5"><div className="mx-auto max-w-[1500px] space-y-5"><div><h1 className="text-lg font-semibold">{business.name}</h1><p className="text-sm text-muted-foreground">Move improvement tips into action, then open one to execute it.</p></div><FeatureCardSummary businessId={businessId} metrics={business.metrics} activeOnly={activeOnly} onToggleActive={() => setActiveOnly((value) => !value)} /><div className="overflow-x-auto pb-4"><TipsKanbanBoard businessId={businessId} tips={sortedTips} activeOnly={activeOnly} /></div>{tips.status === "CanLoadMore" ? <button className="text-sm text-muted-foreground underline" onClick={() => tips.loadMore(100)}>Load more tips</button> : null}</div></main>
}
