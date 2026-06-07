"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { TipConversation } from "@/components/tip-conversation"
import { ReviewCard } from "@/components/review-card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  CATEGORY_LABELS,
  PRIORITY_BADGE,
  TIP_STATUS_LABELS,
} from "@/lib/format"
import { ArrowLeft, Loader2, MessageSquareText } from "lucide-react"

export default function TipWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; tipId: string }>
}) {
  const { id, tipId: rawTipId } = use(params)
  const businessId = id as Id<"businesses">
  const tipId = rawTipId as Id<"tips">
  const searchParams = useSearchParams()
  const workspace = useQuery(api.tips.getWorkspace, { tipId })
  const updateStatus = useMutation(api.tips.updateStatus)
  const [reviewsOpen, setReviewsOpen] = useState(false)

  if (workspace === undefined)
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  if (workspace === null || workspace.tip.businessId !== businessId)
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Tip not found.
      </div>
    )
  const { tip, sourceReviews } = workspace

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-2 mt-2 shrink-0 rounded-2xl border bg-card px-3 py-3 shadow-sm sm:mx-4 sm:mt-4 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start gap-3 sm:gap-4">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="mt-0.5 size-7 shrink-0"
          >
            <Link href={`/businesses/${businessId}`} aria-label="Back to board">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={PRIORITY_BADGE[tip.priority]}>
                {tip.priority}
              </Badge>
              <Badge variant="outline">{CATEGORY_LABELS[tip.category]}</Badge>
            </div>
            <h1 className="mt-3 text-sm font-semibold">{tip.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-start gap-2 sm:gap-3">
              <p className="line-clamp-2 max-w-4xl flex-1 text-xs leading-relaxed text-muted-foreground">
                {tip.content}
              </p>
              {sourceReviews.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => setReviewsOpen(true)}
                >
                  <MessageSquareText className="size-3" />
                  {sourceReviews.length} sources
                </Button>
              ) : null}
            </div>
          </div>
          <Select
            value={tip.status}
            onValueChange={(status) =>
              updateStatus({ tipId, status: status as typeof tip.status })
            }
          >
            <SelectTrigger size="sm" className="ml-10 shrink-0 sm:ml-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIP_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TipConversation
        businessId={businessId}
        tipId={tipId}
        autoKickoff={searchParams.get("start") === "1"}
      />

      <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Source reviews</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {sourceReviews.map((review) => (
              <ReviewCard key={review._id} review={review} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
