"use client"

import { useRef, useState } from "react"
import { UserButton } from "@clerk/nextjs"
import { AnimatePresence, motion } from "framer-motion"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { AuthGate } from "@/components/auth-gate"
import { Logo } from "@/components/logo"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

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
type PlaceSuggestion = { name: string; address: string; mapsUrl: string; dataId?: string }
type ScrapeResult = { websiteUrl: string | null; menuPages: string[]; menuImages: string[]; menuPDFs: string[] }

interface FormState {
  name: string
  type: BusinessType | ""
  description: string
  google: string
  numberOfEmployees: string
  turnover: TurnoverRange | ""
  location: string
  seasonality: Seasonality | ""
}

const STEPS = [
  { label: "Business", title: "Find your business", description: "Start with the essentials. We will use your public presence to do the heavy lifting.", icon: Search },
  { label: "Story", title: "Tell us about it", description: "A little context helps Five Star understand what makes the business distinct.", icon: Building2 },
  { label: "Operations", title: "Add the finishing details", description: "These details are optional, but they sharpen the recommendations we prepare.", icon: Users },
] as const

function OnboardingForm() {
  const router = useRouter()
  const createBusiness = useMutation(api.businesses.create)
  const businesses = useQuery(api.businesses.listAllByCurrentUser)
  const getMapsOptions = useAction(api.scraper.getMapsOptions)
  const scrapeMenuFromUrl = useAction(api.scraper.scrapeMenuFromUrl)
  const hasBusinesses = (businesses?.length ?? 0) > 0
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "",
    description: "",
    google: "",
    numberOfEmployees: "",
    turnover: "",
    location: "",
    seasonality: "",
  })

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const lastSearchedQuery = useRef<string>("")

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSearch() {
    const query = form.name.trim()
    if (query.length < 3 || query === lastSearchedQuery.current) return
    lastSearchedQuery.current = query
    setIsSearching(true)
    setNoResults(false)
    try {
      const results = await getMapsOptions({ businessName: query, businessType: form.type || undefined })
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
      setNoResults(results.length === 0)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
      setNoResults(true)
    } finally {
      setIsSearching(false)
    }
  }

  async function handlePlaceSelect(place: PlaceSuggestion) {
    setSelectedPlace(place)
    set("name", place.name)
    set("google", place.mapsUrl)
    setSuggestions([])
    setShowSuggestions(false)
    setNoResults(false)
    setScrapeResult(null)
    setIsScraping(true)
    try {
      setScrapeResult(await scrapeMenuFromUrl({ mapsUrl: place.mapsUrl, dataId: place.dataId }))
    } catch (error) {
      console.warn("Background scrape failed:", error)
    } finally {
      setIsScraping(false)
    }
  }

  function handleClearPlace() {
    setSelectedPlace(null)
    set("google", "")
    setSuggestions([])
    setShowSuggestions(false)
    setNoResults(false)
    setScrapeResult(null)
    lastSearchedQuery.current = ""
  }

  function move(next: number) {
    setSubmitError(null)
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.type) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const employeeCount = Number.parseInt(form.numberOfEmployees, 10)
      const id = await createBusiness({
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        website: scrapeResult?.websiteUrl ?? undefined,
        numberOfEmployees: Number.isFinite(employeeCount) ? employeeCount : undefined,
        turnover: form.turnover || undefined,
        location: form.location.trim() || undefined,
        seasonality: form.seasonality || undefined,
        socialLinks: form.google ? { google: form.google } : undefined,
      })
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

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3">
        {hasBusinesses ? (
          <Button variant="ghost" onClick={() => router.push("/")} className="rounded-full text-muted-foreground hover:bg-muted">
            <ArrowLeft className="size-4" /> Back
          </Button>
        ) : (
          <Logo className="h-7" />
        )}
        <UserButton />
      </header>

      <div className="mx-auto grid min-h-[calc(100svh-61px)] max-w-5xl gap-8 px-4 py-8 md:grid-cols-[0.65fr_1.35fr] md:items-center">
        <aside className="self-start md:self-center">
          <p className="text-xs font-medium text-muted-foreground">
            {hasBusinesses ? "New workspace" : "Welcome to Five Star"}
          </p>
          <h1 className="mt-2 max-w-md text-2xl font-semibold tracking-tight">
            A clearer picture starts here.
          </h1>
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
          <div className="h-1 bg-muted"><motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} /></div>
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
                  <BusinessStep
                    form={form}
                    set={set}
                    selectedPlace={selectedPlace}
                    suggestions={suggestions}
                    showSuggestions={showSuggestions}
                    noResults={noResults}
                    isSearching={isSearching}
                    isScraping={isScraping}
                    onSelect={handlePlaceSelect}
                    onClear={handleClearPlace}
                    onSuggestionsChange={setShowSuggestions}
                    onSelectedPlaceChange={setSelectedPlace}
                    onSearch={handleSearch}
                  />
                ) : step === 1 ? (
                  <StoryStep form={form} set={set} />
                ) : (
                  <OperationsStep form={form} set={set} selectedPlace={selectedPlace} website={scrapeResult?.websiteUrl ?? null} />
                )}
              </motion.div>
            </AnimatePresence>

            {submitError ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p> : null}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => move(step - 1)} disabled={step === 0 || isSubmitting} className="rounded-full text-muted-foreground hover:bg-muted">
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
      </div>
    </main>
  )
}

function BusinessStep({
  form,
  set,
  selectedPlace,
  suggestions,
  showSuggestions,
  noResults,
  isSearching,
  isScraping,
  onSelect,
  onClear,
  onSuggestionsChange,
  onSelectedPlaceChange,
  onSearch,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  selectedPlace: PlaceSuggestion | null
  suggestions: PlaceSuggestion[]
  showSuggestions: boolean
  noResults: boolean
  isSearching: boolean
  isScraping: boolean
  onSelect: (place: PlaceSuggestion) => void
  onClear: () => void
  onSuggestionsChange: (show: boolean) => void
  onSelectedPlaceChange: (place: PlaceSuggestion | null) => void
  onSearch: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-foreground">Business name *</Label>
        <div className="relative">
          <Input
            id="name"
            autoComplete="off"
            value={form.name}
            onChange={(event) => {
              if (selectedPlace && event.target.value !== selectedPlace.name) {
                onSelectedPlaceChange(null)
                set("google", "")
              }
              if (event.target.value.trim().length < 3) {
                onSuggestionsChange(false)
              }
              set("name", event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void onSearch()
              }
            }}
            onFocus={() => suggestions.length > 0 && !selectedPlace && onSuggestionsChange(true)}
            onBlur={() => window.setTimeout(() => onSuggestionsChange(false), 150)}
            placeholder="Type your business name and press Search"
            className="h-10 pr-20"
          />
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            {selectedPlace ? (
              <button type="button" onClick={onClear} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            ) : (
              <button
                type="button"
                onClick={() => void onSearch()}
                disabled={isSearching || form.name.trim().length < 3}
                className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                {isSearching ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                Search
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 ? (
            <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
              <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Google Maps results</p>
              {suggestions.map((place) => (
                <button key={`${place.mapsUrl}-${place.name}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void onSelect(place)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{place.name}</span><span className="block truncate text-xs text-muted-foreground">{place.address}</span></span>
                </button>
              ))}
            </div>
          ) : null}
          {noResults && !isSearching && !selectedPlace && form.name.trim().length >= 3 ? <p className="mt-2 text-xs text-muted-foreground">No matching Google Maps place found. You can still continue manually.</p> : null}
        </div>
        {selectedPlace ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
            <MapPin className="size-4 shrink-0" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{selectedPlace.name}</p><p className="truncate text-xs text-muted-foreground">{selectedPlace.address}</p></div>
            {isScraping ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Scanning</span> : <Check className="size-4" />}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <Label htmlFor="google" className="text-xs text-muted-foreground">Google Maps URL <span className="font-normal">(optional)</span></Label>
            <Input id="google" type="url" value={form.google} onChange={(event) => set("google", event.target.value)} placeholder="https://maps.google.com/..." />
          </div>
        )}
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

function StoryStep({ form, set }: { form: FormState; set: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="description" className="text-foreground">Business description</Label>
        <Textarea id="description" value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="What should we know about the experience you offer?" rows={6} className="resize-none" />
        <p className="text-xs text-muted-foreground">A sentence or two is enough. Public details may also be discovered during setup.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="location" className="text-foreground">Location context</Label>
        <Input id="location" value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="e.g. central Bucharest, rural Transylvania" />
        <p className="text-xs text-muted-foreground">We use this to understand local and seasonal operating patterns.</p>
      </div>
    </div>
  )
}

function OperationsStep({ form, set, selectedPlace, website }: { form: FormState; set: <K extends keyof FormState>(key: K, value: FormState[K]) => void; selectedPlace: PlaceSuggestion | null; website: string | null }) {
  const turnoverLabel = TURNOVER_RANGES.find((range) => range.value === form.turnover)?.label
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="employees" className="text-foreground">Employees</Label><Input id="employees" type="number" min={0} value={form.numberOfEmployees} onChange={(event) => set("numberOfEmployees", event.target.value)} placeholder="e.g. 12" /></div>
        <div className="space-y-2"><Label className="text-foreground">Operation period</Label><Select value={form.seasonality} onValueChange={(value) => set("seasonality", value as Seasonality)}><SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger><SelectContent><SelectItem value="all_year">All year</SelectItem><SelectItem value="seasonal">Seasonal</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-2"><Label className="text-foreground">Annual turnover</Label><Select value={form.turnover} onValueChange={(value) => set("turnover", value as TurnoverRange)}><SelectTrigger><SelectValue placeholder="Select turnover range" /></SelectTrigger><SelectContent>{TURNOVER_RANGES.map((range) => <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="rounded-2xl bg-muted/60 p-5 ring-1 ring-foreground/10">
        <p className="text-xs font-medium text-muted-foreground">Workspace summary</p>
        <div className="mt-3 flex items-start justify-between gap-4"><div><p className="text-lg font-semibold">{form.name || "Your business"}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{form.type || "Business type not selected"}</p></div><span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="size-4" /></span></div>
        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <span>{selectedPlace ? "Google profile connected" : form.google ? "Google URL added" : "No Google profile"}</span>
          <span>{website ? "Website discovered" : "Website discovery pending"}</span>
          <span>{form.numberOfEmployees ? `${form.numberOfEmployees} employees` : "Team size not provided"}</span>
          <span>{turnoverLabel ?? "Turnover not provided"}</span>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return <AuthGate><OnboardingForm /></AuthGate>
}
