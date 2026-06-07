"use client"

import { useState } from "react"
import { usePaginatedQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { FeatureCard } from "@/components/feature-card"
import { ReviewCard } from "@/components/review-card"
import { StarRating } from "@/components/star-rating"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Progress } from "@workspace/ui/components/progress"
import { Lightbulb, MessageSquareText, Smile, Star } from "lucide-react"
import { formatCount } from "@/lib/format"

type Modal = "rating" | "reviews" | "sentiment" | null

export function FeatureCardSummary({
  businessId,
  metrics,
  activeOnly,
  onToggleActive,
}: {
  businessId: Id<"businesses">
  metrics: Doc<"businessMetrics"> | null
  activeOnly: boolean
  onToggleActive: () => void
}) {
  const [modal, setModal] = useState<Modal>(null)
  const reviews = usePaginatedQuery(api.reviews.listByBusiness, { businessId }, { initialNumItems: 10 })
  const count = metrics?.reviewCount ?? 0
  const dist = metrics?.ratingDistribution
  const rows = dist ? [[5, dist.five], [4, dist.four], [3, dist.three], [2, dist.two], [1, dist.one]] : []
  const sentiment = metrics?.sentimentBreakdown
  const sentimentTotal = sentiment ? sentiment.positive + sentiment.neutral + sentiment.negative : 0

  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <FeatureCard icon={<Star className="size-4" />} title={<span className="flex items-center gap-1.5 text-2xl font-semibold">{metrics ? metrics.avgRating.toFixed(1) : "—"}{metrics ? <StarRating value={metrics.avgRating} /> : null}</span>} onClick={() => setModal("rating")}>
          {count ? `from ${formatCount(count)} reviews` : "Average rating"}
        </FeatureCard>
        <FeatureCard icon={<MessageSquareText className="size-4" />} title={<span className="text-2xl font-semibold">{formatCount(count)}</span>} onClick={() => setModal("reviews")}>Total reviews</FeatureCard>
        <FeatureCard icon={<Lightbulb className="size-4" />} title={<span className="flex items-center gap-2 text-2xl font-semibold">{formatCount((metrics?.pendingTipsCount ?? 0) + (metrics?.inProgressTipsCount ?? 0))}{activeOnly ? <Badge>Filtered</Badge> : null}</span>} onClick={onToggleActive}>Open tips</FeatureCard>
        <FeatureCard icon={<Smile className="size-4" />} title={<span className="text-2xl font-semibold">{metrics?.positivityScore?.toFixed(1) ?? "—"}</span>} onClick={() => setModal("sentiment")}>Positivity score</FeatureCard>
      </div>

      <Dialog open={modal === "rating"} onOpenChange={() => setModal(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Rating distribution</DialogTitle></DialogHeader><div className="space-y-2">{rows.map(([stars, value]) => <div key={stars} className="flex items-center gap-3"><span className="w-12 text-sm text-muted-foreground">{stars} star</span><Progress value={count ? (value! / count) * 100 : 0} className="h-2" /><span className="w-8 text-right text-sm">{value}</span></div>)}</div></DialogContent></Dialog>
      <Dialog open={modal === "reviews"} onOpenChange={() => setModal(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Recent reviews</DialogTitle></DialogHeader><div className="space-y-3">{reviews.results.map((review) => <ReviewCard key={review._id} review={review} />)}{reviews.status === "CanLoadMore" ? <Button variant="outline" className="w-full" onClick={() => reviews.loadMore(10)}>Load more</Button> : null}</div></DialogContent></Dialog>
      <Dialog open={modal === "sentiment"} onOpenChange={() => setModal(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Sentiment breakdown</DialogTitle></DialogHeader>{sentimentTotal ? <div className="space-y-3">{(["positive", "neutral", "negative"] as const).map((key) => <div key={key}><div className="flex justify-between text-sm capitalize"><span>{key}</span><span>{sentiment![key]} · {Math.round(sentiment![key] / sentimentTotal * 100)}%</span></div><Progress value={sentiment![key] / sentimentTotal * 100} className="mt-1 h-2" /></div>)}</div> : <p className="text-sm text-muted-foreground">Not enough data yet.</p>}</DialogContent></Dialog>
    </>
  )
}
