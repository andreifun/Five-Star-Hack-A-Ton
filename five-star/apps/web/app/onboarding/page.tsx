"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useAction } from "convex/react"
import { UserButton } from "@clerk/nextjs"
import { api } from "@/convex/_generated/api"
import { AuthGate } from "@/components/auth-gate"
import { Logo } from "@/components/logo"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { MapPin, Loader2, X } from "lucide-react"

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "cafe", label: "Café" },
  { value: "bar", label: "Bar" },
] as const

type BusinessType = "restaurant" | "hotel" | "cafe" | "bar"
type Seasonality = "all_year" | "seasonal"
type TurnoverRange =
  | "under_100k"
  | "100k_500k"
  | "500k_1m"
  | "1m_5m"
  | "5m_10m"
  | "over_10m"

const TURNOVER_RANGES: { value: TurnoverRange; label: string }[] = [
  { value: "under_100k", label: "Under 100,000 RON" },
  { value: "100k_500k", label: "100,000 – 500,000 RON" },
  { value: "500k_1m", label: "500,000 – 1,000,000 RON" },
  { value: "1m_5m", label: "1,000,000 – 5,000,000 RON" },
  { value: "5m_10m", label: "5,000,000 – 10,000,000 RON" },
  { value: "over_10m", label: "Over 10,000,000 RON" },
]

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

type PlaceSuggestion = { name: string; address: string; mapsUrl: string; dataId: string }

function OnboardingForm() {
  const router = useRouter()
  const createBusiness = useMutation(api.businesses.create)
  const businesses = useQuery(api.businesses.listAllByCurrentUser)
  const getMapsOptions = useAction(api.scraper.getMapsOptions)
  const scrapeMenuFromUrl = useAction(api.scraper.scrapeMenuFromUrl)
  const hasBusinesses = (businesses?.length ?? 0) > 0
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // ── Place search state ──────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Action 1: debounced search as the user types
  useEffect(() => {
    if (selectedPlace) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (form.name.trim().length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await getMapsOptions({ businessName: form.name.trim() })
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsSearching(false)
      }
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.name, selectedPlace])

  // Action 2: triggered when user picks a place
  async function handlePlaceSelect(place: PlaceSuggestion) {
    setSelectedPlace(place)
    set("name", place.name)
    set("google", place.mapsUrl)
    setSuggestions([])
    setShowSuggestions(false)

    // Fire-and-forget background scrape — logs results when done
    setIsScraping(true)
    try {
      const result = await scrapeMenuFromUrl({ mapsUrl: place.mapsUrl, dataId: place.dataId })
      console.log("Scrape result:", result)
    } catch (err) {
      console.warn("Background scrape failed:", err)
    } finally {
      setIsScraping(false)
    }
  }

  function handleClearPlace() {
    setSelectedPlace(null)
    set("google", "")
    setSuggestions([])
    setShowSuggestions(false)
  }

  const [submitError, setSubmitError] = useState<string | null>(null)

  const canSubmit = form.name.trim().length > 0 && form.type !== ""

  async function handleSubmit() {
    if (!form.name || !form.type) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const id = await createBusiness({
        name: form.name,
        type: form.type as BusinessType,
        description: form.description || undefined,
        socialLinks: form.google ? { google: form.google } : undefined,
      })
      router.push(`/businesses/${id}/setup`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        {hasBusinesses ? (
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            ← Back
          </Button>
        ) : (
          <Logo className="h-7" />
        )}
        <UserButton />
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="font-heading text-lg font-semibold">
              {hasBusinesses
                ? "Add a business"
                : "Welcome — let's add your first business"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Tell us about your business</p>
            <Separator className="mt-3" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Business information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Business name *</Label>
                <div className="relative">
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => {
                      if (selectedPlace && e.target.value !== selectedPlace.name) {
                        setSelectedPlace(null)
                        set("google", "")
                      }
                      set("name", e.target.value)
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0 && !selectedPlace) setShowSuggestions(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 150)
                    }}
                    placeholder="e.g. The Golden Fork"
                    autoComplete="off"
                    className={selectedPlace ? "border-green-500 pr-8 focus-visible:ring-green-500" : ""}
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                  {selectedPlace && !isSearching && (
                    <button
                      type="button"
                      onClick={handleClearPlace}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label="Clear selection"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
                      <p className="border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Google Maps results
                      </p>
                      {suggestions.map((place, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handlePlaceSelect(place)}
                          className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{place.name}</p>
                            {place.address && (
                              <p className="truncate text-xs text-muted-foreground">{place.address}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPlace && (
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950/30">
                    <MapPin className="size-4 shrink-0 text-green-600 dark:text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-green-800 dark:text-green-300">{selectedPlace.name}</p>
                      <p className="truncate text-xs text-green-600 dark:text-green-500">{selectedPlace.address}</p>
                    </div>
                    {isScraping && (
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <Loader2 className="size-3 animate-spin" />
                        <span>Scanning…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Business type *</Label>
                <RadioGroup
                  value={form.type}
                  onValueChange={(v) => set("type", v as BusinessType)}
                  className="grid grid-cols-2 gap-2"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <div key={t.value} className="flex items-center space-x-2 rounded-md border p-3">
                      <RadioGroupItem value={t.value} id={t.value} />
                      <Label htmlFor={t.value} className="cursor-pointer font-normal">{t.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="A short description of your business…"
                  rows={3}
                />
              </div>
              {!selectedPlace && (
                <div className="space-y-2">
                  <Label htmlFor="google">Google Maps URL</Label>
                  <Input
                    id="google"
                    type="url"
                    value={form.google}
                    onChange={(e) => set("google", e.target.value)}
                    placeholder="https://maps.google.com/…"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="numberOfEmployees">Number of employees</Label>
                <Input
                  id="numberOfEmployees"
                  type="number"
                  min={0}
                  value={form.numberOfEmployees}
                  onChange={(e) => set("numberOfEmployees", e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="space-y-2">
                <Label>Annual turnover (RON)</Label>
                <Select value={form.turnover} onValueChange={(v) => set("turnover", v as TurnoverRange)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select turnover range" />
                  </SelectTrigger>
                  <SelectContent>
                    {TURNOVER_RANGES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. downtown Paris, rural Tuscany…"
                />
                <p className="text-xs text-muted-foreground">We'll determine whether this is a rural or urban location.</p>
              </div>
              <div className="space-y-2">
                <Label>Operation period</Label>
                <Select value={form.seasonality} onValueChange={(v) => set("seasonality", v as Seasonality)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operation period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_year">All year</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-end gap-2">
              {submitError && (
                <p className="w-full text-sm text-destructive">{submitError}</p>
              )}
              <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? "Creating…" : "Create business"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <AuthGate>
      <OnboardingForm />
    </AuthGate>
  )
}
