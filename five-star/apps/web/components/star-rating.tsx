import { Star } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function StarRating({
  value,
  size = "sm",
  showValue = false,
  className,
}: {
  value: number
  size?: "sm" | "md"
  showValue?: boolean
  className?: string
}) {
  const rounded = Math.round(value)
  const starSize = size === "md" ? "size-5" : "size-3.5"

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              starSize,
              i < rounded
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted",
            )}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-medium tabular-nums">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  )
}
