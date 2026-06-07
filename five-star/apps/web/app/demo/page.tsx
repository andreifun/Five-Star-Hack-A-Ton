"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, Sparkles } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { AuthGate, FullScreenLoader } from "@/components/auth-gate"
import { Logo } from "@/components/logo"
import { DEMO_SETUP_STEP_MS, DEMO_SETUP_STEPS, DEMO_SLIDES } from "@/lib/demo-content"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"

type Phase = "slides" | "confirm" | "setup"

function DemoExperience() {
  const router = useRouter()
  const preview = useQuery(api.demo.getTemplatePreview)
  const prepare = useMutation(api.demo.prepare)
  const [phase, setPhase] = useState<Phase>("slides")
  const [slide, setSlide] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

  useEffect(() => {
    if (phase !== "setup" || !isPreparing) return
    const timers = DEMO_SETUP_STEPS.map((_, index) =>
      window.setTimeout(() => setCompletedSteps(index + 1), DEMO_SETUP_STEP_MS * (index + 1)),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [isPreparing, phase])

  useEffect(() => {
    if (phase !== "setup" || completedSteps !== DEMO_SETUP_STEPS.length || !businessId) return
    const timer = window.setTimeout(() => router.push(`/businesses/${businessId}`), 500)
    return () => window.clearTimeout(timer)
  }, [businessId, completedSteps, phase, router])

  async function startDemo() {
    setError(null)
    setCompletedSteps(0)
    setBusinessId(null)
    setIsPreparing(true)
    setPhase("setup")
    try {
      setBusinessId(await prepare())
    } catch (caught) {
      setIsPreparing(false)
      setCompletedSteps(0)
      setError(caught instanceof Error ? caught.message : "The demo workspace could not be prepared.")
    }
  }

  if (preview === undefined) return <FullScreenLoader />
  if (preview.status === "error") {
    return <DemoError message={preview.message} onBack={() => router.push("/")} />
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f4f0e8] text-[#171712]">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#171712_0.7px,transparent_0.7px)] [background-size:18px_18px]" />
      <div className="absolute -right-40 -top-48 size-[34rem] rounded-full bg-[#ff5b35]/20 blur-3xl" />
      <div className="absolute -bottom-56 -left-32 size-[38rem] rounded-full bg-[#b5d9c4]/60 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Logo className="h-7" />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/45">
          <span className="size-2 rounded-full bg-[#ff5b35]" />
          Live demo
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-76px)] max-w-6xl items-center px-6 pb-10 md:px-10">
        <AnimatePresence mode="wait">
          {phase === "slides" ? (
            <PitchSlides
              key="slides"
              slide={slide}
              onBack={() => setSlide((value) => Math.max(0, value - 1))}
              onNext={() => {
                if (slide === DEMO_SLIDES.length - 1) setPhase("confirm")
                else setSlide((value) => value + 1)
              }}
            />
          ) : phase === "confirm" ? (
            <ConfirmBusiness
              key="confirm"
              preview={preview}
              onBack={() => setPhase("slides")}
              onStart={() => void startDemo()}
            />
          ) : (
            <SetupBusiness
              key="setup"
              completedSteps={completedSteps}
              error={error}
              onRetry={() => void startDemo()}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

function PitchSlides({
  slide,
  onBack,
  onNext,
}: {
  slide: number
  onBack: () => void
  onNext: () => void
}) {
  const content = DEMO_SLIDES[slide]!
  const Icon = content.icon
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
      className="grid w-full gap-12 md:grid-cols-[1.25fr_0.75fr] md:items-end"
    >
      <div>
        <div className="mb-10 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-black/15 bg-white/50">
            <Icon className="size-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">{content.eyebrow}</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] md:text-7xl">
              {content.title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-black/55">{content.description}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-12 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} disabled={slide === 0} className="rounded-full border-black/15 bg-white/40">
            <ChevronLeft className="size-4" />
          </Button>
          <Button onClick={onNext} className="rounded-full bg-[#171712] px-6 text-[#f4f0e8] hover:bg-black">
            {slide === DEMO_SLIDES.length - 1 ? "See it in action" : "Continue"}
            <ChevronRight className="ml-2 size-4" />
          </Button>
          <div className="ml-3 flex gap-1.5">
            {DEMO_SLIDES.map((_, index) => (
              <span key={index} className={`h-1.5 rounded-full transition-all ${index === slide ? "w-8 bg-[#ff5b35]" : "w-1.5 bg-black/15"}`} />
            ))}
          </div>
        </div>
      </div>
      <motion.div
        key={`metric-${slide}`}
        initial={{ opacity: 0, scale: 0.92, rotate: 3 }}
        animate={{ opacity: 1, scale: 1, rotate: -2 }}
        className="relative justify-self-end rounded-[2rem] border border-black/10 bg-[#ff5b35] p-8 shadow-[0_30px_80px_rgba(23,23,18,0.18)] md:p-10"
      >
        <div className="absolute -right-3 -top-3 size-8 rounded-full border border-black/15 bg-[#f4f0e8]" />
        <p className="text-7xl font-semibold tracking-[-0.08em] text-[#171712] md:text-8xl">{content.metric}</p>
        <p className="mt-5 max-w-48 text-sm font-medium leading-snug text-black/60">{content.metricLabel}</p>
      </motion.div>
    </motion.section>
  )
}

type ReadyPreview = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.demo.getTemplatePreview>>>, { status: "ready" }>

function ConfirmBusiness({
  preview,
  onBack,
  onStart,
}: {
  preview: ReadyPreview
  onBack: () => void
  onStart: () => void
}) {
  const location = [preview.address, preview.city, preview.country].filter(Boolean).join(", ")
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mx-auto w-full max-w-3xl">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff5b35]">Your workspace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] md:text-5xl">We found your business.</h1>
        <p className="mt-3 text-black/50">Confirm the details and we will prepare your intelligence workspace.</p>
      </div>
      <Card className="overflow-hidden rounded-[2rem] border-black/10 bg-white/65 py-0 shadow-[0_24px_80px_rgba(23,23,18,0.12)] backdrop-blur">
        <CardContent className="grid gap-0 p-0 md:grid-cols-[1fr_0.7fr]">
          <div className="p-7 md:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{preview.type}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{preview.name}</h2>
              </div>
              <div className="flex size-11 items-center justify-center rounded-full bg-[#b5d9c4]"><Check className="size-5" /></div>
            </div>
            <p className="mt-5 line-clamp-3 text-sm leading-relaxed text-black/55">{preview.description ?? "Your real business data is ready to be analyzed."}</p>
            {location ? <p className="mt-6 flex items-start gap-2 text-sm text-black/55"><MapPin className="mt-0.5 size-4 shrink-0 text-[#ff5b35]" />{location}</p> : null}
          </div>
          <div className="flex flex-col justify-between border-t border-black/10 bg-[#171712] p-7 text-[#f4f0e8] md:border-l md:border-t-0 md:p-9">
            <div>
              <Sparkles className="size-5 text-[#ff7554]" />
              <p className="mt-5 text-sm leading-relaxed text-white/55">We will connect your feedback, identify the strongest signals, and prepare actionable opportunities.</p>
            </div>
            <Button onClick={onStart} className="mt-8 rounded-full bg-[#ff5b35] text-[#171712] hover:bg-[#ff7554]">
              Prepare workspace <ChevronRight className="ml-2 size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <Button variant="ghost" onClick={onBack} className="mx-auto mt-5 flex rounded-full text-black/50 hover:bg-black/5"><ChevronLeft className="mr-2 size-4" />Back to pitch</Button>
    </motion.section>
  )
}

function SetupBusiness({
  completedSteps,
  error,
  onRetry,
}: {
  completedSteps: number
  error: string | null
  onRetry: () => void
}) {
  const percent = (completedSteps / DEMO_SETUP_STEPS.length) * 100
  return (
    <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto w-full max-w-xl">
      <div className="mb-9 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#171712] text-[#f4f0e8] shadow-xl">
          {completedSteps === DEMO_SETUP_STEPS.length && !error ? <Check className="size-6" /> : <Loader2 className="size-6 animate-spin" />}
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em]">{error ? "Setup needs attention" : completedSteps === DEMO_SETUP_STEPS.length ? "Workspace ready." : "Building your advantage."}</h1>
        <p className="mt-3 text-sm text-black/50">{error ?? "Real business data is being organized into a workspace you can act on."}</p>
      </div>
      <Card className="rounded-[2rem] border-black/10 bg-white/65 py-0 shadow-[0_24px_80px_rgba(23,23,18,0.12)] backdrop-blur">
        <CardContent className="space-y-5 p-7 md:p-9">
          <Progress value={percent} className="h-1.5 bg-black/10 [&_[data-slot=progress-indicator]]:bg-[#ff5b35]" />
          <div className="space-y-2">
            {DEMO_SETUP_STEPS.map((step, index) => {
              const Icon = step.icon
              const complete = index < completedSteps
              const active = index === completedSteps && !error
              return (
                <motion.div key={step.label} animate={{ opacity: complete || active ? 1 : 0.35 }} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <div className={`flex size-9 items-center justify-center rounded-full ${complete ? "bg-[#b5d9c4]" : active ? "bg-[#ff5b35]" : "bg-black/5"}`}>
                    {complete ? <Check className="size-4" /> : <Icon className={`size-4 ${active ? "animate-pulse" : ""}`} />}
                  </div>
                  <span className="text-sm font-medium">{step.label}</span>
                  {active ? <span className="ml-auto text-xs text-black/40">Working…</span> : null}
                </motion.div>
              )
            })}
          </div>
          {error ? <Button onClick={onRetry} className="w-full rounded-full bg-[#171712] text-[#f4f0e8]">Try again</Button> : null}
        </CardContent>
      </Card>
    </motion.section>
  )
}

function DemoError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f4f0e8] p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Demo unavailable</h1>
        <p className="mt-3 text-sm text-black/55">{message}</p>
        <Button onClick={onBack} className="mt-6 rounded-full">Back to workspace</Button>
      </div>
    </div>
  )
}

export default function DemoPage() {
  return <AuthGate><DemoExperience /></AuthGate>
}
