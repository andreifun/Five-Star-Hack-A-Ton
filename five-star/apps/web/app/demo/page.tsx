"use client"

import { useState } from "react"
import { UserButton } from "@clerk/nextjs"
import { AnimatePresence, motion } from "framer-motion"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { AuthGate, FullScreenLoader } from "@/components/auth-gate"
import { Logo } from "@/components/logo"
import { Button } from "@workspace/ui/components/button"
import { DEMO_SLIDES } from "@/lib/demo-content"

function BusinessPicker({ onNext }: { onNext: (id: Id<"businesses">) => void }) {
  const templates = useQuery(api.demo.listTemplates)
  const [selected, setSelected] = useState<Id<"businesses"> | null>(null)

  if (templates === undefined) return <FullScreenLoader />

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto w-full max-w-2xl py-8"
    >
      <p className="text-xs font-medium text-muted-foreground">Live demo</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pick a business for this demo</h1>
      <p className="mt-2 text-sm text-muted-foreground">We&apos;ll clone its data into a fresh demo workspace.</p>

      {templates.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-muted/60 p-8 text-center ring-1 ring-foreground/10">
          <Building2 className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No businesses found</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a non-demo business to your account first.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {templates.map((b) => {
            const addressLine = [b.city, b.country].filter(Boolean).join(", ")
            const isSelected = selected === b._id
            return (
              <button
                key={b._id}
                type="button"
                onClick={() => setSelected(b._id)}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name}</p>
                  {addressLine ? (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" /> {addressLine}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{b.type}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button onClick={() => selected && onNext(selected)} disabled={!selected} className="px-5">
          Continue <ChevronRight className="size-4" />
        </Button>
      </div>
    </motion.div>
  )
}

function PitchSlides({ slide, isLaunching, launchError, onBack, onNext }: {
  slide: number
  isLaunching: boolean
  launchError: string | null
  onBack: () => void
  onNext: () => void
}) {
  const content = DEMO_SLIDES[slide]!
  const Icon = content.icon
  const isLast = slide === DEMO_SLIDES.length - 1
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
      className="w-full max-w-3xl"
    >
      <div className="mb-10 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{content.eyebrow}</p>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={slide}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl">
            {content.title}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">{content.description}</p>
        </motion.div>
      </AnimatePresence>
      {launchError ? (
        <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{launchError}</p>
      ) : null}
      <div className="mt-12 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} disabled={isLaunching} className="rounded-full">
          <ChevronLeft className="size-4" />
        </Button>
        <Button onClick={onNext} disabled={isLaunching} className="rounded-full px-6">
          {isLaunching ? <Loader2 className="size-4 animate-spin" /> : null}
          {isLaunching ? "Creating workspace..." : isLast ? "See it in action" : "Continue"}
          {!isLaunching && !isLast ? <ChevronRight className="ml-2 size-4" /> : null}
        </Button>
        <div className="ml-3 flex gap-1.5">
          {DEMO_SLIDES.map((_, index) => (
            <span key={index} className={`h-1.5 rounded-full transition-all ${index === slide ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

type Phase = "picker" | "slides"

function DemoExperience() {
  const router = useRouter()
  const prepare = useMutation(api.demo.prepare)
  const [phase, setPhase] = useState<Phase>("picker")
  const [selectedId, setSelectedId] = useState<Id<"businesses"> | null>(null)
  const [slide, setSlide] = useState(0)
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  async function handleLaunch() {
    if (!selectedId) return
    setIsLaunching(true)
    setLaunchError(null)
    try {
      const id = await prepare({ businessId: selectedId })
      router.push(`/businesses/${id}/setup`)
    } catch (error) {
      setIsLaunching(false)
      setLaunchError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Logo className="h-7" />
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:flex">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            Live demo
          </span>
          <UserButton />
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100svh-57px)] max-w-6xl items-center px-4 pb-10 md:px-10">
        <AnimatePresence mode="wait">
          {phase === "picker" ? (
            <BusinessPicker
              key="picker"
              onNext={(id) => { setSelectedId(id); setPhase("slides") }}
            />
          ) : (
            <PitchSlides
              key="slides"
              slide={slide}
              isLaunching={isLaunching}
              launchError={launchError}
              onBack={() => slide === 0 ? setPhase("picker") : setSlide((v) => v - 1)}
              onNext={() => {
                if (slide === DEMO_SLIDES.length - 1) void handleLaunch()
                else setSlide((v) => v + 1)
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

export default function DemoPage() {
  return (
    <AuthGate>
      <DemoExperience />
    </AuthGate>
  )
}
