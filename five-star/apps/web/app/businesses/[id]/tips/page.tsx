"use client"

import { useState } from "react"
import { usePaginatedQuery, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useCurrentBusiness } from "@/components/business-context"
import { TipCard } from "@/components/tip-card"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2, Sparkles } from "lucide-react"
import { TIP_STATUS_LABELS } from "@/lib/format"

type TipStatus = Doc<"tips">["status"]

const STATUSES: TipStatus[] = ["pending", "in_progress", "done", "dismissed"]

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export default function TipsPage() {
  const { businessId } = useCurrentBusiness()
  const [statusFilter, setStatusFilter] = useState<TipStatus | undefined>(
    "pending",
  )
  const [regenerating, setRegenerating] = useState(false)
  const regenerate = useAction(api.ai.generateTips.regenerate)

  const { results, status, loadMore } = usePaginatedQuery(
    api.tips.listByBusiness,
    { businessId, status: statusFilter },
    { initialNumItems: 20 },
  )

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await regenerate({ businessId })
      setStatusFilter("pending")
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Improvement tips</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {regenerating ? "Generating…" : "Generate tips"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={!statusFilter}
            onClick={() => setStatusFilter(undefined)}
          >
            All
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {TIP_STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>

        {status === "LoadingFirstPage" ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No tips here yet. Generate tips from your reviews to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {results.map((tip) => (
              <TipCard key={tip._id} tip={tip} />
            ))}
          </div>
        )}

        {status === "CanLoadMore" && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => loadMore(20)}>
              Load more
            </Button>
          </div>
        )}
        {status === "LoadingMore" && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
