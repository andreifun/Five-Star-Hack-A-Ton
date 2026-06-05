"use client"

import Link from "next/link"
import { usePaginatedQuery, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCurrentBusiness } from "@/components/business-context"
import { StarRating } from "@/components/star-rating"
import { ReviewCard } from "@/components/review-card"
import { TipCard } from "@/components/tip-card"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import { Button } from "@workspace/ui/components/button"
import { Loader2, ArrowRight, Star, MessageSquareText, Lightbulb, Smile, RefreshCw } from "lucide-react"
import { BUSINESS_TYPE_LABELS, formatCount } from "@/lib/format"
import { useState } from "react"
import { useRouter } from "next/navigation"

function MetricCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold">{children}</div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { businessId, business } = useCurrentBusiness()
  const router = useRouter()
  const refreshData = useMutation(api.businesses.refreshData)
  const setupDone = useQuery(api.setupTasks.allCompleted, { businessId })
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshData({ businessId })
      router.push(`/businesses/${businessId}/setup`)
    } finally {
      setRefreshing(false)
    }
  }

  const recentReviews = usePaginatedQuery(
    api.reviews.listByBusiness,
    { businessId },
    { initialNumItems: 5 },
  )
  const topTips = usePaginatedQuery(
    api.tips.listByBusiness,
    { businessId, status: "pending" },
    { initialNumItems: 5 },
  )

  if (business === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (business === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          This business could not be found.
        </p>
      </div>
    )
  }

  const metrics = business.metrics
  const reviewCount = metrics?.reviewCount ?? 0
  const sentiment = metrics?.sentimentBreakdown
  const sentimentTotal = sentiment
    ? sentiment.positive + sentiment.neutral + sentiment.negative
    : 0
  const positivePct =
    sentimentTotal > 0
      ? Math.round((sentiment!.positive / sentimentTotal) * 100)
      : 0

  const dist = metrics?.ratingDistribution
  const distRows: { stars: number; count: number }[] = dist
    ? [
        { stars: 5, count: dist.five },
        { stars: 4, count: dist.four },
        { stars: 3, count: dist.three },
        { stars: 2, count: dist.two },
        { stars: 1, count: dist.one },
      ]
    : []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{business.name}</h1>
            <Badge variant="outline">{BUSINESS_TYPE_LABELS[business.type]}</Badge>
          </div>
          {setupDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-3.5" />
              )}
              Refresh data
            </Button>
          )}
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard icon={<Star className="size-3.5" />} label="Average rating">
            {metrics && reviewCount > 0 ? (
              <div className="flex items-center gap-2">
                {metrics.avgRating.toFixed(1)}
                <StarRating value={metrics.avgRating} />
              </div>
            ) : (
              "—"
            )}
          </MetricCard>
          <MetricCard
            icon={<MessageSquareText className="size-3.5" />}
            label="Total reviews"
          >
            {formatCount(reviewCount)}
          </MetricCard>
          <MetricCard
            icon={<Lightbulb className="size-3.5" />}
            label="Open tips"
          >
            {formatCount(metrics?.pendingTipsCount ?? 0)}
          </MetricCard>
          <MetricCard icon={<Smile className="size-3.5" />} label="Positive">
            {sentimentTotal > 0 ? `${positivePct}%` : "—"}
          </MetricCard>
        </div>

        {/* Rating distribution */}
        {reviewCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rating distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {distRows.map((row) => (
                <div key={row.stars} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-sm text-muted-foreground">
                    {row.stars} star
                  </span>
                  <Progress
                    value={reviewCount > 0 ? (row.count / reviewCount) * 100 : 0}
                    className="h-2"
                  />
                  <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent reviews + Priority tips */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Recent reviews</h2>
              <Link
                href={`/businesses/${businessId}/reviews`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {recentReviews.results.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No reviews imported yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentReviews.results.map((review) => (
                  <ReviewCard key={review._id} review={review} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Priority tips</h2>
              <Link
                href={`/businesses/${businessId}/tips`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {topTips.results.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No open tips. You&apos;re all caught up.
              </p>
            ) : (
              <div className="space-y-3">
                {topTips.results.map((tip) => (
                  <TipCard key={tip._id} tip={tip} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
