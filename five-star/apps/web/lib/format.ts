import type { Doc } from "@/convex/_generated/dataModel"

type Sentiment = NonNullable<Doc<"reviews">["sentiment"]>
type Source = Doc<"reviews">["source"]
type Priority = Doc<"tips">["priority"]
type TipStatus = Doc<"tips">["status"]
type TipCategory = Doc<"tips">["category"]
type BusinessType = Doc<"businesses">["type"]

export const SOURCE_LABELS: Record<Source, string> = {
  google: "Google",
  tripadvisor: "TripAdvisor",
  booking: "Booking.com",
  yelp: "Yelp",
  manual: "Manual",
  other: "Other",
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
}

export const CATEGORY_LABELS: Record<TipCategory, string> = {
  service: "Service",
  ambiance: "Ambiance",
  menu: "Menu",
  cleanliness: "Cleanliness",
  value: "Value",
  communication: "Communication",
  operations: "Operations",
  marketing: "Marketing",
  staff: "Staff",
  other: "Other",
}

export const TIP_STATUS_LABELS: Record<TipStatus, string> = {
  pending: "To do",
  in_progress: "In progress",
  done: "Done",
  dismissed: "Dismissed",
}

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

export const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

export const SENTIMENT_BADGE: Record<Sentiment, BadgeVariant> = {
  positive: "secondary",
  neutral: "outline",
  negative: "destructive",
}

export function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return "Today"
  if (diff < 2 * day) return "Yesterday"
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatAbsoluteDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export type RecencyLevel = "new" | "recent" | "older"

export function getRecencyLevel(timestamp: number): RecencyLevel {
  const diff = Date.now() - timestamp
  const day = 24 * 60 * 60 * 1000
  if (diff < 7 * day) return "new"
  if (diff < 30 * day) return "recent"
  return "older"
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}
