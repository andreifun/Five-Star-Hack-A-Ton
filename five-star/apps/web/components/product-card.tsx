"use client"

import type { Doc } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { formatCount } from "@/lib/format"

export function ProductCard({ product }: { product: Doc<"products"> }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{product.name}</p>
            {product.isSignatureDish && (
              <Badge variant="default" className="text-xs">Signature</Badge>
            )}
            {!product.isAvailable && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Unavailable</Badge>
            )}
          </div>
          {product.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
          )}
        </div>
        {product.price !== undefined && (
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {product.currency ?? ""}
            {formatCount(product.price)}
          </span>
        )}
      </div>
      {(product.category || product.tags?.length) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.category && (
            <Badge variant="outline" className="text-xs">{product.category}</Badge>
          )}
          {product.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
