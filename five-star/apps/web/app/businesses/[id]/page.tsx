"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  usePaginatedQuery,
  useMutation,
  useQuery,
  useAction,
} from "convex/react"
import { Streamdown } from "streamdown"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCurrentBusiness } from "@/components/business-context"
import { StarRating } from "@/components/star-rating"
import { ReviewCard } from "@/components/review-card"
import { TipCard } from "@/components/tip-card"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Loader2,
  Star,
  MessageSquareText,
  Lightbulb,
  Smile,
  ArrowUp,
  History,
  RefreshCw,
  Plus,
  MessageCircle,
} from "lucide-react"
import {
  BUSINESS_TYPE_LABELS,
  formatCount,
  formatRelativeDate,
} from "@/lib/format"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"

type ModalId = "rating" | "reviews" | "tips" | "sentiment" | null

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const messageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: string
  onClick: () => void
}) {
  return (
    <motion.div variants={cardVariants}>
      <Card
        size="sm"
        className="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.98]"
        onClick={onClick}
      >
        <CardContent className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="size-3.5" />
            {label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          {sub && (
            <p className="text-xs text-muted-foreground">{sub}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function DashboardPage() {
  const { businessId, business } = useCurrentBusiness()
  const router = useRouter()

  // Refresh
  const refreshData = useMutation(api.businesses.refreshData)
  const setupDone = useQuery(api.setupTasks.allCompleted, { businessId })
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [activeModal, setActiveModal] = useState<ModalId>(null)

  // Threads
  const [activeThreadId, setActiveThreadId] = useState<Id<"chatThreads"> | null>(null)
  const [threadBrowserOpen, setThreadBrowserOpen] = useState(false)
  const creatingRef = useRef(false)
  const createThread = useMutation(api.chatThreads.create)
  const sendMessage = useAction(api.ai.chat.sendMessage)

  // Chat input
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load threads list
  const threadsResult = useQuery(api.chatThreads.listByBusiness, {
    businessId,
    paginationOpts: { numItems: 30, cursor: null },
  })

  // Auto-create or pick initial thread
  useEffect(() => {
    if (activeThreadId || threadsResult === undefined) return
    const first = threadsResult.page[0]
    if (first) {
      setActiveThreadId(first._id)
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    createThread({ businessId }).then((id) => {
      setActiveThreadId(id)
      creatingRef.current = false
    })
  }, [threadsResult, activeThreadId, businessId, createThread])

  // Load messages
  const messages = useQuery(
    api.chatMessages.listByThread,
    activeThreadId
      ? { threadId: activeThreadId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  )

  // Paginated data for modals
  const recentReviews = usePaginatedQuery(
    api.reviews.listByBusiness,
    { businessId },
    { initialNumItems: 10 },
  )
  const topTips = usePaginatedQuery(
    api.tips.listByBusiness,
    { businessId, status: "pending" },
    { initialNumItems: 10 },
  )

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshData({ businessId })
      router.push(`/businesses/${businessId}/setup`)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleNewThread() {
    creatingRef.current = true
    const id = await createThread({ businessId })
    creatingRef.current = false
    setActiveThreadId(id)
    setThreadBrowserOpen(false)
  }

  async function submit() {
    const text = input.trim()
    if (!text || isSending || !activeThreadId) return
    setInput("")
    setIsSending(true)
    try {
      await sendMessage({ threadId: activeThreadId, businessId, content: text })
    } finally {
      setIsSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

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
  const distRows = dist
    ? [
        { stars: 5, count: dist.five },
        { stars: 4, count: dist.four },
        { stars: 3, count: dist.three },
        { stars: 2, count: dist.two },
        { stars: 1, count: dist.one },
      ]
    : []

  const visibleMessages =
    messages?.page.filter((m) => m.role !== "system") ?? []
  const isReady = activeThreadId !== null && messages !== undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Info cards ── */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{business.name}</span>
              <Badge variant="outline" className="text-xs">
                {BUSINESS_TYPE_LABELS[business.type]}
              </Badge>
            </div>
            {setupDone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-7 gap-1 text-xs"
              >
                {refreshing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Refresh
              </Button>
            )}
          </div>
          <motion.div
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <InfoCard
              icon={Star}
              label="Average rating"
              value={
                metrics && reviewCount > 0 ? (
                  <span className="flex items-center gap-1.5">
                    {metrics.avgRating.toFixed(1)}
                    <StarRating value={metrics.avgRating} />
                  </span>
                ) : (
                  "—"
                )
              }
              sub={reviewCount > 0 ? `from ${formatCount(reviewCount)} reviews` : undefined}
              onClick={() => setActiveModal("rating")}
            />
            <InfoCard
              icon={MessageSquareText}
              label="Total reviews"
              value={formatCount(reviewCount)}
              sub="tap to browse"
              onClick={() => setActiveModal("reviews")}
            />
            <InfoCard
              icon={Lightbulb}
              label="Open tips"
              value={formatCount(metrics?.pendingTipsCount ?? 0)}
              sub="tap to view"
              onClick={() => setActiveModal("tips")}
            />
            <InfoCard
              icon={Smile}
              label="Positive"
              value={sentimentTotal > 0 ? `${positivePct}%` : "—"}
              sub={
                sentimentTotal > 0
                  ? `${sentiment!.positive} positive reviews`
                  : undefined
              }
              onClick={() => setActiveModal("sentiment")}
            />
          </motion.div>
        </div>
      </div>

      {/* ── Chat messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {!isReady && (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {isReady && visibleMessages.length === 0 && !isSending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <MessageCircle className="mx-auto mb-3 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Ask anything about your reviews, ratings, or how to improve.
              </p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {visibleMessages.map((msg) => (
              <motion.div
                key={msg._id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "min-w-0 max-w-[85%] text-sm",
                      msg.isError && "text-destructive",
                    )}
                  >
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isSending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex gap-1 px-1 py-2">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Prompt bar ── */}
      <div className="shrink-0 border-t px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setThreadBrowserOpen(true)}
            title="Chat history"
          >
            <History className="size-4" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask your assistant…"
            rows={1}
            className="resize-none overflow-hidden"
            disabled={!isReady || isSending}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={!isReady || isSending || !input.trim()}
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </form>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </p>
      </div>

      {/* ── Rating distribution modal ── */}
      <Dialog open={activeModal === "rating"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rating distribution</DialogTitle>
          </DialogHeader>
          {reviewCount === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold">
                  {metrics?.avgRating.toFixed(1)}
                </span>
                <div>
                  <StarRating value={metrics?.avgRating ?? 0} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCount(reviewCount)} reviews
                  </p>
                </div>
              </div>
              <div className="space-y-2">
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reviews modal ── */}
      <Dialog open={activeModal === "reviews"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recent reviews</DialogTitle>
          </DialogHeader>
          {recentReviews.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews imported yet.</p>
          ) : (
            <div className="space-y-3">
              {recentReviews.results.map((review) => (
                <ReviewCard key={review._id} review={review} />
              ))}
              {recentReviews.status === "CanLoadMore" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => recentReviews.loadMore(10)}
                >
                  Load more
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Tips modal ── */}
      <Dialog open={activeModal === "tips"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Priority tips</DialogTitle>
          </DialogHeader>
          {topTips.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open tips. You&apos;re all caught up.
            </p>
          ) : (
            <div className="space-y-3">
              {topTips.results.map((tip) => (
                <TipCard key={tip._id} tip={tip} />
              ))}
              {topTips.status === "CanLoadMore" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => topTips.loadMore(10)}
                >
                  Load more
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Sentiment modal ── */}
      <Dialog open={activeModal === "sentiment"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sentiment breakdown</DialogTitle>
          </DialogHeader>
          {sentimentTotal === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          ) : (
            <div className="space-y-3">
              {(
                [
                  {
                    label: "Positive",
                    count: sentiment!.positive,
                    className: "bg-green-500",
                  },
                  {
                    label: "Neutral",
                    count: sentiment!.neutral,
                    className: "bg-yellow-400",
                  },
                  {
                    label: "Negative",
                    count: sentiment!.negative,
                    className: "bg-red-500",
                  },
                ] as const
              ).map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.count} ·{" "}
                      {Math.round((row.count / sentimentTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn("h-full rounded-full", row.className)}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(row.count / sentimentTotal) * 100}%`,
                      }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Thread browser sheet ── */}
      <Sheet open={threadBrowserOpen} onOpenChange={setThreadBrowserOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Chat history</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col overflow-hidden" style={{ height: "calc(100% - 65px)" }}>
            <div className="px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleNewThread}
              >
                <Plus className="size-3.5" />
                New chat
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {threadsResult === undefined ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : threadsResult.page.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">
                  No conversations yet.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {threadsResult.page.map((thread) => (
                    <button
                      key={thread._id}
                      onClick={() => {
                        setActiveThreadId(thread._id)
                        setThreadBrowserOpen(false)
                      }}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                        thread._id === activeThreadId && "bg-muted",
                      )}
                    >
                      <p className="truncate text-sm font-medium">
                        {thread.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {thread.messageCount} msg
                        {thread.lastMessageAt
                          ? ` · ${formatRelativeDate(thread.lastMessageAt)}`
                          : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
