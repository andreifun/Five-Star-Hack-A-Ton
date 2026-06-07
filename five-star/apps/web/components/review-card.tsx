import type { Doc } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { StarRating } from "@/components/star-rating"
import {
  SOURCE_LABELS,
  SENTIMENT_BADGE,
  formatRelativeDate,
  getRecencyLevel,
} from "@/lib/format"

const RECENCY_BADGE: Record<
  "new" | "recent",
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  recent: {
    label: "Recent",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
}

function positivityPillClass(score: number): string {
  if (score <= -10) return "border-red-900 bg-red-950 text-red-300"
  if (score < -2) return "border-red-500 bg-red-950/60 text-red-400"
  if (score <= 2) return "border-border bg-muted text-muted-foreground"
  if (score >= 10) return "border-green-700 bg-green-950 text-green-400"
  return "border-blue-500 bg-blue-950/60 text-blue-400"
}

export function ReviewCard({ review }: { review: Doc<"reviews"> }) {
  const recency = getRecencyLevel(review.reviewDate)

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {review.reviewerName ?? "Anonymous"}
            {review.isAngry && (
              <span className="ml-1.5" title="Appears written in anger">
                😤
              </span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StarRating value={review.rating} />
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(review.reviewDate)}
            </span>
            {recency !== "older" && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RECENCY_BADGE[recency].className}`}
              >
                {RECENCY_BADGE[recency].label}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {review.sentimentScore !== undefined && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${positivityPillClass(review.sentimentScore)}`}
            >
              {review.sentimentScore >= 0 ? "+" : ""}
              {review.sentimentScore.toFixed(1)}
            </span>
          )}
          {review.sentiment && (
            <Badge variant={SENTIMENT_BADGE[review.sentiment]}>
              {review.sentiment}
            </Badge>
          )}
          <Badge variant="outline">{SOURCE_LABELS[review.source]}</Badge>
        </div>
      </div>

      {review.title && (
        <p className="mt-2 text-sm font-medium">{review.title}</p>
      )}
      {review.text?.trim() ? (
        <p className="mt-1 text-sm text-muted-foreground">{review.text}</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground/60 italic">
          No review text
        </p>
      )}

      {review.ownerReply && (
        <div className="mt-3 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Your reply
          </p>
          <p className="mt-1 text-sm">{review.ownerReply}</p>
        </div>
      )}
    </div>
  )
}
