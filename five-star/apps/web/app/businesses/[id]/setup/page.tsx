"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { UserButton } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDashed,
  Globe2,
  Lightbulb,
  ListChecks,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { Logo } from "@/components/logo"
import { useCurrentBusiness } from "@/components/business-context"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"

type TaskStatus = Doc<"setupTasks">["status"]

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  google: "Google",
  tripadvisor: "Tripadvisor",
  yelp: "Yelp",
  manual: "Manual",
  other: "Other",
}

function AnimatedNumber({ value }: { value: number | undefined }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {(value ?? 0).toLocaleString()}
    </motion.span>
  )
}

function SetupPageContent() {
  const { businessId, business } = useCurrentBusiness()
  const router = useRouter()
  const overview = useQuery(api.setupTasks.getOverview, { businessId })
  const retrySetup = useMutation(api.businesses.retrySetup)
  const [retrying, setRetrying] = useState(false)
  const [animatedCount, setAnimatedCount] = useState<number | null>(null)
  const animationStarted = useRef(false)

  // When all tasks arrive already completed (demo), fake-reveal them one by one
  useEffect(() => {
    if (!overview || animationStarted.current) return
    const actionable = overview.tasks.filter((t) => t.status !== "skipped")
    if (actionable.length > 0 && actionable.every((t) => t.status === "completed")) {
      animationStarted.current = true
      setAnimatedCount(0)
    }
  }, [overview])

  // Tick: 2–3 seconds per task
  useEffect(() => {
    if (animatedCount === null) return
    const actionable = (overview?.tasks ?? []).filter((t) => t.status !== "skipped")
    if (animatedCount >= actionable.length) return
    const timer = window.setTimeout(
      () => setAnimatedCount((c) => (c ?? 0) + 1),
      2000 + Math.random() * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [animatedCount, overview])

  const state = useMemo(() => {
    const tasks = overview?.tasks ?? []
    const actionable = tasks.filter((task) => task.status !== "skipped")
    const failed = tasks.filter((task) => task.status === "failed")

    if (animatedCount !== null) {
      const done = Math.min(animatedCount, actionable.length)
      return {
        tasks,
        failed: [],
        complete: done >= actionable.length,
        percent: actionable.length > 0 ? Math.round((done / actionable.length) * 100) : 0,
        completedCount: done,
      }
    }

    const settled = actionable.filter((task) => task.status === "completed" || task.status === "failed")
    return {
      tasks,
      failed,
      complete: tasks.length > 0 && tasks.every((task) => task.status !== "pending" && task.status !== "running"),
      percent: actionable.length > 0 ? Math.round((settled.length / actionable.length) * 100) : 0,
      completedCount: tasks.filter((t) => t.status === "completed").length,
    }
  }, [overview, animatedCount])

  const successful = state.complete && state.failed.length === 0

  useEffect(() => {
    if (!successful) return
    const timer = window.setTimeout(() => router.push(`/businesses/${businessId}`), 1200)
    return () => window.clearTimeout(timer)
  }, [businessId, router, successful])

  async function handleRetry() {
    setRetrying(true)
    try {
      await retrySetup({ businessId })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Logo className="h-7" />
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:flex">
            <span className={`size-2 rounded-full ${state.complete ? "bg-secondary" : "animate-pulse bg-primary"}`} />
            {state.complete ? "Setup complete" : "Live setup"}
          </span>
          <UserButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <div className={`flex size-12 items-center justify-center rounded-2xl text-background shadow-xl ${state.failed.length > 0 ? "bg-red-600" : "bg-foreground"}`}>
              {successful ? <Check className="size-5" /> : state.failed.length > 0 && state.complete ? <TriangleAlert className="size-5" /> : <Loader2 className="size-5 animate-spin" />}
            </div>
            <p className="mt-5 text-xs font-medium text-muted-foreground">
              {business?.name}
            </p>
            <h1 className="mt-1 max-w-2xl text-2xl font-semibold tracking-tight">
              {successful ? "Your workspace is ready." : state.complete && state.failed.length > 0 ? "Setup needs attention." : "Building your advantage."}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {successful
                ? "Your live business intelligence workspace is prepared. Taking you there now."
                : state.complete && state.failed.length > 0
                  ? "We kept everything already discovered. Retry the remaining tasks when you are ready."
                  : "Public business data is being organized into a clear operating picture. Every number below is live."}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-5 shadow-md ring-1 ring-foreground/10">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-medium text-muted-foreground">Workspace progress</p><p className="mt-1 text-2xl font-semibold"><AnimatedNumber value={state.percent} />%</p></div>
              <p className="text-right text-xs leading-relaxed text-muted-foreground">{state.completedCount} completed<br />{state.tasks.filter((task) => task.status === "skipped").length} skipped</p>
            </div>
            <Progress value={state.percent} className="mt-5 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-primary" />
          </div>
        </motion.section>

        {overview === undefined ? (
          <div className="flex justify-center py-28"><Loader2 className="size-7 animate-spin text-muted-foreground/70" /></div>
        ) : overview === null ? null : (
          <>
            <section className="mt-6 grid gap-2 sm:grid-cols-3">
              <DiscoveryWidget icon={Globe2} label="Sources connected" value={overview.discoveries.connectedSources.length}>
                {overview.discoveries.connectedSources.length > 0 ? overview.discoveries.connectedSources.map((source) => SOURCE_LABELS[source] ?? source).join(" · ") : "Searching for sources"}
              </DiscoveryWidget>
              <DiscoveryWidget icon={Star} label="Reviews found" value={overview.discoveries.reviewCount}>
                {Object.entries(overview.discoveries.reviewsBySource).length > 0 ? Object.entries(overview.discoveries.reviewsBySource).map(([source, count]) => `${SOURCE_LABELS[source] ?? source} ${count}`).join(" · ") : "Waiting for review imports"}
              </DiscoveryWidget>
              <DiscoveryWidget icon={Lightbulb} label="Tips prepared" value={overview.discoveries.tipCount}>
                Prioritized opportunities ready to act on
              </DiscoveryWidget>
            </section>

            <section className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl bg-card p-5 shadow-md ring-1 ring-foreground/10">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live activity</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Preparing your workspace</h2></div>
                  <ListChecks className="size-5 text-muted-foreground/70" />
                </div>
                <div className="mt-6 space-y-1">
                  {(() => {
                    let actionableIndex = 0
                    return state.tasks.map((task) => {
                      let displayStatus = task.status
                      if (animatedCount !== null && task.status !== "skipped") {
                        const idx = actionableIndex++
                        if (idx < animatedCount) displayStatus = "completed"
                        else if (idx === animatedCount) displayStatus = "running"
                        else displayStatus = "pending"
                      }
                      return <TaskRow key={task._id} task={task} displayStatus={displayStatus} />
                    })
                  })()}
                </div>
                {state.complete ? (
                  <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
                    {state.failed.length > 0 ? <Button variant="outline" onClick={() => void handleRetry()} disabled={retrying} className="rounded-full border-border bg-card"><RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} /> Retry failed tasks</Button> : null}
                    <Button onClick={() => router.push(`/businesses/${businessId}`)} className="rounded-full bg-foreground text-background hover:bg-foreground/90">Open dashboard <ArrowRight className="size-4" /></Button>
                  </div>
                ) : null}
              </div>
              <ProfileWidget profile={overview.profile} />
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function DiscoveryWidget({ icon: Icon, label, value, children }: { icon: typeof Globe2; label: string; value: number | undefined; children: React.ReactNode }) {
  return (
    <motion.div layout className="relative h-28 overflow-hidden rounded-2xl bg-card p-4 shadow-md ring-1 ring-foreground/10">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-4" /><p className="text-xs font-medium">{label}</p></div>
      <p className="mt-2 text-2xl font-semibold"><AnimatedNumber value={value} /></p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{children}</p>
      <div className="pointer-events-none absolute -bottom-8 -right-3 size-16 rotate-12 rounded-2xl bg-muted ring-1 ring-foreground/10" />
      <div className="pointer-events-none absolute -bottom-9 right-5 size-16 -rotate-6 rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10" />
    </motion.div>
  )
}

function TaskRow({ task, displayStatus }: { task: Doc<"setupTasks">; displayStatus: TaskStatus }) {
  const icons: Record<TaskStatus, React.ReactNode> = {
    pending: <CircleDashed className="size-4 text-muted-foreground/60" />,
    running: <Loader2 className="size-4 animate-spin text-primary" />,
    completed: <CheckCircle2 className="size-4 text-emerald-700" />,
    failed: <TriangleAlert className="size-4 text-red-600" />,
    skipped: <CircleDashed className="size-4 text-muted-foreground/50" />,
  }
  return (
    <motion.div layout animate={{ opacity: displayStatus === "pending" || displayStatus === "skipped" ? 0.4 : 1 }} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
      <span className="mt-0.5">{icons[displayStatus]}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{task.label}</p>{task.message && displayStatus === "failed" ? <p className="mt-0.5 truncate text-xs text-red-600/70">{task.message}</p> : null}</div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{displayStatus === "completed" ? "Done" : displayStatus}</span>
    </motion.div>
  )
}

function ProfileWidget({ profile }: { profile: { name: string; description?: string; address?: string; city?: string; country?: string; phone?: string; openingHours?: string; website?: string; locationType?: "rural" | "urban" } }) {
  const details = [
    profile.website ? { label: "Website", value: profile.website, icon: Globe2 } : null,
    profile.address || profile.city || profile.country ? { label: "Location", value: [profile.address, profile.city, profile.country].filter(Boolean).join(", "), icon: MapPin } : null,
    profile.phone ? { label: "Phone", value: profile.phone, icon: Building2 } : null,
    profile.locationType ? { label: "Area", value: `${profile.locationType} location`, icon: MapPin } : null,
  ].filter((detail): detail is NonNullable<typeof detail> => detail !== null)
  return (
    <div className="rounded-2xl bg-card p-5 shadow-md ring-1 ring-foreground/10">
      <div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Profile discoveries</p><h2 className="mt-1 text-lg font-semibold">{profile.name}</h2></div><Sparkles className="size-5 text-primary" /></div>
      {profile.description ? <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{profile.description}</p> : null}
      <div className="mt-6 space-y-4">
        {details.length > 0 ? details.map((detail) => {
          const Icon = detail.icon
          return <motion.div layout key={detail.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="size-3.5 text-muted-foreground" /></span><div className="min-w-0"><p className="text-xs font-medium">{detail.label}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{detail.value}</p></div></motion.div>
        }) : <p className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Business details will appear here as they are discovered.</p>}
      </div>
    </div>
  )
}

export default function SetupPage() {
  return <SetupPageContent />
}
