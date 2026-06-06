"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
import { FeatureCard } from "@/components/feature-card"
import { PromptBar } from "@/components/prompt-bar"
import { TodoPanel } from "@/components/todo-panel"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import { Button } from "@workspace/ui/components/button"
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
  History,
  RefreshCw,
  Plus,
  MessageCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import {
  BUSINESS_TYPE_LABELS,
  formatCount,
  formatRelativeDate,
} from "@/lib/format"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"

type ModalId = "rating" | "reviews" | "tips" | "sentiment" | null

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}
const messageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

export default function DashboardPage() {
  const { businessId, business } = useCurrentBusiness()
  const router = useRouter()

  const refreshData = useMutation(api.businesses.refreshData)
  const setupDone = useQuery(api.setupTasks.allCompleted, { businessId })
  const [refreshing, setRefreshing] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalId>(null)
  const [cardsExpanded, setCardsExpanded] = useState(true)

  const [activeThreadId, setActiveThreadId] = useState<Id<"chatThreads"> | null>(null)
  const [threadBrowserOpen, setThreadBrowserOpen] = useState(false)
  const creatingRef = useRef(false)
  const createThread = useMutation(api.chatThreads.create)
  const sendMessage = useAction(api.ai.chat.sendMessage)
  const calcPositivity = useAction(api.ai.calculatePositivity.regenerate)

  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const threadsResult = useQuery(api.chatThreads.listByBusiness, {
    businessId,
    paginationOpts: { numItems: 30, cursor: null },
  })

  const todos = useQuery(api.agentTodos.listByBusiness, { businessId }) ?? []
  const completeTodo = useMutation(api.agentTodos.complete)
  const deleteTodo = useMutation(api.agentTodos.remove)

  useEffect(() => {
    if (activeThreadId || threadsResult === undefined) return
    const first = threadsResult.page[0]
    if (first) { setActiveThreadId(first._id); return }
    if (creatingRef.current) return
    creatingRef.current = true
    createThread({ businessId }).then((id) => {
      setActiveThreadId(id)
      creatingRef.current = false
    })
  }, [threadsResult, activeThreadId, businessId, createThread])

  const messages = useQuery(
    api.chatMessages.listByThread,
    activeThreadId
      ? { threadId: activeThreadId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  )

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  useEffect(() => {
    const metrics = business?.metrics
    if (businessId && metrics && metrics.positivityScore === undefined && metrics.reviewCount > 0) {
      void calcPositivity({ businessId })
    }
  }, [businessId, business?.metrics?.positivityScore, business?.metrics?.reviewCount, calcPositivity])

  const hasMessages = (messages?.page.filter((m) => m.role !== "system") ?? []).length > 0

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

  async function submit({ model }: { model: string; images: File[] }) {
    const text = input.trim()
    if (!text || isSending || !activeThreadId) return
    setInput("")
    setIsSending(true)
    try {
      await sendMessage({ threadId: activeThreadId, businessId, content: text, model })
    } finally {
      setIsSending(false)
    }
  }

  const handleExplain = useCallback(
    async (title: string, description: string) => {
      const text = `Can you explain this task in more detail: "${title}"?\n\n${description}`
      if (isSending || !activeThreadId) return
      setInput("")
      setIsSending(true)
      try {
        await sendMessage({
          threadId: activeThreadId,
          businessId,
          content: text,
          model: "anthropic/claude-sonnet-4-5",
        })
      } finally {
        setIsSending(false)
      }
    },
    [isSending, activeThreadId, businessId, sendMessage],
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
        <p className="text-sm text-muted-foreground">This business could not be found.</p>
      </div>
    )
  }

  const metrics = business.metrics
  const reviewCount = metrics?.reviewCount ?? 0
  const sentiment = metrics?.sentimentBreakdown
  const sentimentTotal = sentiment ? sentiment.positive + sentiment.neutral + sentiment.negative : 0
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

  const visibleMessages = messages?.page.filter((m) => m.role !== "system") ?? []
  const isReady = activeThreadId !== null && messages !== undefined
  const hasTodos = todos.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{business.name}</span>
              <Badge variant="outline" className="text-xs">
                {BUSINESS_TYPE_LABELS[business.type]}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              {/* Compact stats strip — visible only when cards are collapsed */}
              <AnimatePresence>
                {!cardsExpanded && metrics && reviewCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2.5 overflow-hidden pr-2 text-xs text-muted-foreground"
                  >
                    <span className="flex items-center gap-1 font-medium tabular-nums">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {metrics.avgRating.toFixed(1)}
                    </span>
                    <span className="text-border">·</span>
                    <span>{formatCount(reviewCount)} reviews</span>
                    <span className="text-border">·</span>
                    <span>{metrics.pendingTipsCount} tips</span>
                    {metrics.positivityScore !== undefined && (
                      <>
                        <span className="text-border">·</span>
                        <span
                          className={cn(
                            "font-medium",
                            metrics.positivityScore >= 2 ? "text-green-600" : metrics.positivityScore < -2 ? "text-red-500" : "",
                          )}
                        >
                          {metrics.positivityScore > 0 ? "+" : ""}
                          {metrics.positivityScore.toFixed(1)}
                        </span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expand / collapse toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => setCardsExpanded((v) => !v)}
              >
                {cardsExpanded ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
                {cardsExpanded ? "Minimize" : "Metrics"}
              </Button>

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
          </div>
        </div>
      </div>

      {/* ── Feature cards (collapsible) ── */}
      <motion.div
        initial={false}
        animate={cardsExpanded
          ? { height: "auto", opacity: 1, marginTop: 10, marginBottom: 0 }
          : { height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }
        }
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{ overflow: "hidden" }}
        className="shrink-0 px-4"
      >
        <div className="mx-auto max-w-2xl pb-4">
          <motion.div
            className="grid grid-cols-2 gap-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={cardVariants}>
              <FeatureCard
                icon={<Star className="size-4" />}
                title={
                  metrics && reviewCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
                      {metrics.avgRating.toFixed(1)}
                      <StarRating value={metrics.avgRating} />
                    </span>
                  ) : (
                    <span className="text-2xl font-semibold">—</span>
                  )
                }
                onClick={() => setActiveModal("rating")}
              >
                {reviewCount > 0 ? `from ${formatCount(reviewCount)} reviews` : "Average rating"}
              </FeatureCard>
            </motion.div>

            <motion.div variants={cardVariants}>
              <FeatureCard
                icon={<MessageSquareText className="size-4" />}
                title={<span className="text-2xl font-semibold tabular-nums">{formatCount(reviewCount)}</span>}
                onClick={() => setActiveModal("reviews")}
              >
                Total reviews
              </FeatureCard>
            </motion.div>

            <motion.div variants={cardVariants}>
              <FeatureCard
                icon={<Lightbulb className="size-4" />}
                title={<span className="text-2xl font-semibold tabular-nums">{formatCount(metrics?.pendingTipsCount ?? 0)}</span>}
                onClick={() => setActiveModal("tips")}
              >
                Open tips
              </FeatureCard>
            </motion.div>

            <motion.div variants={cardVariants}>
              <FeatureCard
                icon={<Smile className="size-4" />}
                title={
                  <span className="text-2xl font-semibold tabular-nums">
                    {metrics?.positivityScore !== undefined ? metrics.positivityScore.toFixed(1) : "—"}
                  </span>
                }
                onClick={() => setActiveModal("sentiment")}
              >
                {metrics?.positivityScore !== undefined
                  ? (() => {
                      const s = metrics.positivityScore!
                      if (s <= -10) return <span className="text-red-900">Very bad</span>
                      if (s < -2) return <span className="text-red-500">Bad</span>
                      if (s <= 2) return <span className="text-muted-foreground">Neutral</span>
                      if (s >= 10) return <span className="text-green-700">Really good</span>
                      return <span className="text-blue-400">Good</span>
                    })()
                  : "Positivity score"}
              </FeatureCard>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Todo panel — fixed to right side of viewport ── */}
      <AnimatePresence>
        {hasTodos && (
          <motion.div
            key="todo-panel"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-4 top-16 bottom-24 z-30 w-72"
          >
            <TodoPanel
              todos={todos}
              onComplete={(id) => completeTodo({ id })}
              onDelete={(id) => deleteTodo({ id })}
              onExplain={handleExplain}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: chat ── */}
      <div className="flex min-h-0 flex-1 px-4">

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto py-4">
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
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {msg.content}
                    </div>
                  ) : (
                    <div className={cn("min-w-0 max-w-[85%] text-sm", msg.isError && "text-destructive")}>
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isSending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
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

      </div>

      {/* ── Prompt bar ── */}
      <PromptBar
        value={input}
        onChange={setInput}
        onSubmit={submit}
        disabled={!isReady || isSending}
        placeholder="Ask your assistant…"
        toolbarLeft={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={() => setThreadBrowserOpen(true)}
          >
            <History className="size-4" />
          </Button>
        }
      />

      {/* ── Rating modal ── */}
      <Dialog open={activeModal === "rating"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rating distribution</DialogTitle></DialogHeader>
          {reviewCount === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold">{metrics?.avgRating.toFixed(1)}</span>
                <div>
                  <StarRating value={metrics?.avgRating ?? 0} />
                  <p className="mt-1 text-xs text-muted-foreground">{formatCount(reviewCount)} reviews</p>
                </div>
              </div>
              <div className="space-y-2">
                {distRows.map((row) => (
                  <div key={row.stars} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-sm text-muted-foreground">{row.stars} star</span>
                    <Progress value={reviewCount > 0 ? (row.count / reviewCount) * 100 : 0} className="h-2" />
                    <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{row.count}</span>
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
          <DialogHeader><DialogTitle>Recent reviews</DialogTitle></DialogHeader>
          {recentReviews.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews imported yet.</p>
          ) : (
            <div className="space-y-3">
              {recentReviews.results.map((review) => (
                <ReviewCard key={review._id} review={review} />
              ))}
              {recentReviews.status === "CanLoadMore" && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => recentReviews.loadMore(10)}>
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
          <DialogHeader><DialogTitle>Priority tips</DialogTitle></DialogHeader>
          {topTips.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tips. You&apos;re all caught up.</p>
          ) : (
            <div className="space-y-3">
              {topTips.results.map((tip) => (
                <TipCard key={tip._id} tip={tip} />
              ))}
              {topTips.status === "CanLoadMore" && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => topTips.loadMore(10)}>
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
          <DialogHeader><DialogTitle>Sentiment breakdown</DialogTitle></DialogHeader>
          {sentimentTotal === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          ) : (
            <div className="space-y-3">
              {([
                { label: "Positive", count: sentiment!.positive, className: "bg-green-500" },
                { label: "Neutral",  count: sentiment!.neutral,  className: "bg-yellow-400" },
                { label: "Negative", count: sentiment!.negative, className: "bg-red-500" },
              ] as const).map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.count} · {Math.round((row.count / sentimentTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn("h-full rounded-full", row.className)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(row.count / sentimentTotal) * 100}%` }}
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
          <SheetHeader><SheetTitle>Chat history</SheetTitle></SheetHeader>
          <div className="flex flex-col overflow-hidden" style={{ height: "calc(100% - 65px)" }}>
            <div className="px-3 py-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleNewThread}>
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
                <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {threadsResult.page.map((thread) => (
                    <button
                      key={thread._id}
                      onClick={() => { setActiveThreadId(thread._id); setThreadBrowserOpen(false) }}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                        thread._id === activeThreadId && "bg-muted",
                      )}
                    >
                      <p className="truncate text-sm font-medium">{thread.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {thread.messageCount} msg
                        {thread.lastMessageAt ? ` · ${formatRelativeDate(thread.lastMessageAt)}` : ""}
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
