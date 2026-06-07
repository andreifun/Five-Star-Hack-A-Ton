"use client"

import { useState } from "react"
import { UserButton } from "@clerk/nextjs"
import { AnimatePresence, motion } from "framer-motion"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { AuthGate, FullScreenLoader } from "@/components/auth-gate"
import { Logo } from "@/components/logo"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { DEMO_SLIDES } from "@/lib/demo-content"

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "cafe", label: "Cafe" },
  { value: "bar", label: "Bar" },
] as const

const TURNOVER_RANGES = [
  { value: "under_100k", label: "Under 100,000 RON" },
  { value: "100k_500k", label: "100,000 - 500,000 RON" },
  { value: "500k_1m", label: "500,000 - 1,000,000 RON" },
  { value: "1m_5m", label: "1,000,000 - 5,000,000 RON" },
  { value: "5m_10m", label: "5,000,000 - 10,000,000 RON" },
  { value: "over_10m", label: "Over 10,000,000 RON" },
] as const

type BusinessType = (typeof BUSINESS_TYPES)[number]["value"]
type TurnoverRange = (typeof TURNOVER_RANGES)[number]["value"]
type Seasonality = "all_year" | "seasonal"

type Template = NonNullable<ReturnType<typeof useQuery<typeof api.demo.listTemplates>>>[number]

interface FormState {
  name: string
  type: BusinessType | ""
  description: string
  numberOfEmployees: string
  location: string
  seasonality: Seasonality | ""
  turnover: TurnoverRange | ""
}

const STEPS = [
  { label: "Business", title: "Your demo business", description: "Your workspace is pre-loaded with a real hospitality business. Review the details and continue.", icon: Search },
  { label: "Story", title: "Tell us about it", description: "A little context helps Five Star understand what makes the business distinct.", icon: Building2 },
  { label: "Operations", title: "Add the finishing details", description: "These details are optional, but they sharpen the recommendations we prepare.", icon: Users },
] as const

// ── Business picker ──────────────────────────────────────────────────────────

function BusinessPicker({ onNext }: { onNext: (template: Template) => void }) {
  const templates = useQuery(api.demo.listTemplates)
  const [selected, setSelected] = useState<Id<"businesses"> | null>(null)

  if (templates === undefined) return <FullScreenLoader />

  const selectedTemplate = templates.find((b) => b._id === selected) ?? null

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
        <Button onClick={() => selectedTemplate && onNext(selectedTemplate)} disabled={!selected} className="px-5">
          Continue <ChevronRight className="size-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// ── Pitch slides ─────────────────────────────────────────────────────────────

function PitchSlides({ slide, onBack, onNext }: { slide: number; onBack: () => void; onNext: () => void }) {
  const content = DEMO_SLIDES[slide]!
  const Icon = content.icon
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
      <div className="mt-12 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} className="rounded-full">
          <ChevronLeft className="size-4" />
        </Button>
        <Button onClick={onNext} className="rounded-full px-6">
          {slide === DEMO_SLIDES.length - 1 ? "See it in action" : "Continue"}
          <ChevronRight className="ml-2 size-4" />
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

// ── Pre-filled onboarding form ───────────────────────────────────────────────

function DemoForm({ template, onBack }: { template: Template; onBack: () => void }) {
  const router = useRouter()
  const prepare = useMutation(api.demo.prepare)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    name: template.name ?? "",
    type: BUSINESS_TYPES.some((t) => t.value === template.type) ? (template.type as BusinessType) : "",
    description: template.description ?? "",
    numberOfEmployees: template.numberOfEmployees != null ? String(template.numberOfEmployees) : "",
    location: template.location ?? "",
    seasonality: template.seasonality ?? "",
    turnover: "",
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function move(next: number) {
    setSubmitError(null)
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const id = await prepare({ businessId: template._id })
      router.push(`/businesses/${id}/setup`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canContinue = step !== 0 || (form.name.trim().length > 0 && form.type !== "")
  const progress = ((step + 1) / STEPS.length) * 100
  const activeStep = STEPS[step]!
  const addressLine = [template.address, template.city, template.country].filter(Boolean).join(", ")
  const turnoverLabel = TURNOVER_RANGES.find((r) => r.value === form.turnover)?.label ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto grid w-full max-w-5xl gap-8 py-8 md:grid-cols-[0.65fr_1.35fr] md:items-center"
    >
      <aside className="self-start md:self-center">
        <p className="text-xs font-medium text-muted-foreground">Live demo</p>
        <h1 className="mt-2 max-w-md text-2xl font-semibold tracking-tight">A clearer picture starts here.</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We will connect the signal around your business and turn it into a workspace your team can act on.
        </p>
        <div className="mt-6 hidden max-w-sm space-y-2 md:block">
          {STEPS.map((item, index) => {
            const Icon = item.icon
            const complete = index < step
            const active = index === step
            return (
              <button key={item.label} type="button" onClick={() => index < step && move(index)} className="flex w-full items-center gap-3 text-left">
                <span className={`flex size-8 items-center justify-center rounded-full transition-colors ${complete ? "bg-secondary text-secondary-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {complete ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className={active || complete ? "text-sm font-medium" : "text-sm text-muted-foreground/70"}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="self-center overflow-hidden rounded-2xl bg-card shadow-md ring-1 ring-foreground/10">
        <div className="h-1 bg-muted">
          <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} />
        </div>
        <div className="p-5 md:p-7">
          <div className="mb-7">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
              {step > 0 ? <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Optional</span> : null}
            </div>
            <h2 className="mt-2 text-xl font-semibold">{activeStep.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{activeStep.description}</p>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {step === 0 ? (
                <BusinessStep form={form} set={set} addressLine={addressLine} />
              ) : step === 1 ? (
                <StoryStep form={form} set={set} />
              ) : (
                <OperationsStep form={form} set={set} turnoverLabel={turnoverLabel} />
              )}
            </motion.div>
          </AnimatePresence>

          {submitError ? (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => step === 0 ? onBack() : move(step - 1)} disabled={isSubmitting} className="rounded-full text-muted-foreground hover:bg-muted">
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => move(step + 1)} disabled={!canContinue} className="px-5">
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => void handleSubmit()} disabled={isSubmitting} className="px-5">
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isSubmitting ? "Creating workspace..." : "Create workspace"}
              </Button>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  )
}

function BusinessStep({
  form,
  set,
  addressLine,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  addressLine: string
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-foreground">Business name *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="Business name"
          className="h-10"
        />
        {addressLine ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
            <MapPin className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{form.name}</p>
              <p className="truncate text-xs text-muted-foreground">{addressLine}</p>
            </div>
            <Check className="size-4" />
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Business type *</Label>
        <RadioGroup value={form.type} onValueChange={(value) => set("type", value as BusinessType)} className="grid grid-cols-2 gap-2">
          {BUSINESS_TYPES.map((type) => (
            <Label key={type.value} htmlFor={type.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors ${form.type === type.value ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
              <RadioGroupItem value={type.value} id={type.value} /> {type.label}
            </Label>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}

function StoryStep({
  form,
  set,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="description" className="text-foreground">Business description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="What should we know about the experience you offer?"
          rows={6}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">A sentence or two is enough. Public details may also be discovered during setup.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="location" className="text-foreground">Location context</Label>
        <Input
          id="location"
          value={form.location}
          onChange={(event) => set("location", event.target.value)}
          placeholder="e.g. central Bucharest, rural Transylvania"
        />
        <p className="text-xs text-muted-foreground">We use this to understand local and seasonal operating patterns.</p>
      </div>
    </div>
  )
}

function OperationsStep({
  form,
  set,
  turnoverLabel,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  turnoverLabel: string | null
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employees" className="text-foreground">Employees</Label>
          <Input id="employees" type="number" min={0} value={form.numberOfEmployees} onChange={(event) => set("numberOfEmployees", event.target.value)} placeholder="e.g. 12" />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Operation period</Label>
          <Select value={form.seasonality} onValueChange={(value) => set("seasonality", value as Seasonality)}>
            <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_year">All year</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Annual turnover</Label>
        <Select value={form.turnover} onValueChange={(value) => set("turnover", value as TurnoverRange)}>
          <SelectTrigger><SelectValue placeholder="Select turnover range" /></SelectTrigger>
          <SelectContent>
            {TURNOVER_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-2xl bg-muted/60 p-5 ring-1 ring-foreground/10">
        <p className="text-xs font-medium text-muted-foreground">Workspace summary</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">{form.name || "Your business"}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">{form.type || "Business type not selected"}</p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <span>Google profile connected</span>
          <span>Reviews pre-imported</span>
          <span>{form.numberOfEmployees ? `${form.numberOfEmployees} employees` : "Team size not provided"}</span>
          <span>{turnoverLabel ?? "Turnover not provided"}</span>
        </div>
      </div>
    </div>
  )
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

type Phase = "picker" | "slides" | "form"

function DemoExperience() {
  const [phase, setPhase] = useState<Phase>("picker")
  const [template, setTemplate] = useState<Template | null>(null)
  const [slide, setSlide] = useState(0)

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
              onNext={(t) => { setTemplate(t); setPhase("slides") }}
            />
          ) : phase === "slides" ? (
            <PitchSlides
              key="slides"
              slide={slide}
              onBack={() => slide === 0 ? setPhase("picker") : setSlide((v) => v - 1)}
              onNext={() => {
                if (slide === DEMO_SLIDES.length - 1) setPhase("form")
                else setSlide((v) => v + 1)
              }}
            />
          ) : (
            <DemoForm key="form" template={template!} onBack={() => setPhase("slides")} />
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
