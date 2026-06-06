"use client"

import { useState } from "react"
import { usePaginatedQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useCurrentBusiness } from "@/components/business-context"
import { ReviewCard } from "@/components/review-card"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2 } from "lucide-react"
import { SOURCE_LABELS } from "@/lib/format"

type Source = Doc<"reviews">["source"]
type Sentiment = NonNullable<Doc<"reviews">["sentiment"]>

const SOURCES: Source[] = [
  "google",
  "tripadvisor",
  "booking",
  "yelp",
  "manual",
  "other",
]
const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"]

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
        "rounded-full border px-3 py-1 text-sm capitalize transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export default function ReviewsPage() {
  const { businessId } = useCurrentBusiness()
  const [source, setSource] = useState<Source | undefined>()
  const [sentiment, setSentiment] = useState<Sentiment | undefined>()

  const { results, status, loadMore } = usePaginatedQuery(
    api.reviews.listByBusiness,
    { businessId, source, sentiment },
    { initialNumItems: 20 },
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <h1 className="text-xl font-semibold">Reviews</h1>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!source} onClick={() => setSource(undefined)}>
              All sources
            </FilterChip>
            {SOURCES.map((s) => (
              <FilterChip
                key={s}
                active={source === s}
                onClick={() => setSource(source === s ? undefined : s)}
              >
                {SOURCE_LABELS[s]}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={!sentiment}
              onClick={() => setSentiment(undefined)}
            >
              All sentiment
            </FilterChip>
            {SENTIMENTS.map((s) => (
              <FilterChip
                key={s}
                active={sentiment === s}
                onClick={() => setSentiment(sentiment === s ? undefined : s)}
              >
                {s}
              </FilterChip>
            ))}
          </div>
        </div>

        {status === "LoadingFirstPage" ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No reviews match these filters.
          </p>
        ) : (
          <div className="space-y-3">
            {results
              .sort((a, b) => {
                const aHasText = !!a.text
                const bHasText = !!b.text
                if (aHasText === bHasText) return 0
                return aHasText ? -1 : 1
              })
              .map((review) => (
                <ReviewCard key={review._id} review={review} />
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
