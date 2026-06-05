import type { Doc } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { StarRating } from "@/components/star-rating"
import {
  SOURCE_LABELS,
  SENTIMENT_BADGE,
  formatRelativeDate,
} from "@/lib/format"

export function ReviewCard({ review }: { review: Doc<"reviews"> }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {review.reviewerName ?? "Anonymous"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StarRating value={review.rating} />
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(review.reviewDate)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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
      {review.text && (
        <p className="mt-1 text-sm text-muted-foreground">{review.text}</p>
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
