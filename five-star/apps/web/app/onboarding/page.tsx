"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
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

function OnboardingForm() {
  const router = useRouter()
  const createBusiness = useMutation(api.businesses.create)
  const businesses = useQuery(api.businesses.listAllByCurrentUser)
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
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. The Golden Fork"
                />
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
