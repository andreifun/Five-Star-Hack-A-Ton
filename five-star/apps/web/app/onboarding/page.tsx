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
import { Badge } from "@workspace/ui/components/badge"
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
type PriceRange = "budget" | "mid" | "upscale" | "luxury"

interface FormState {
  name: string
  type: BusinessType | ""
  description: string
  website: string
  google: string
  tripadvisor: string
  instagram: string
  facebook: string
  booking: string
  yelp: string
  city: string
  country: string
  phone: string
  priceRange: PriceRange | ""
  cuisineInput: string
  cuisineTags: string[]
  openingHours: string
}

function OnboardingForm() {
  const router = useRouter()
  const createBusiness = useMutation(api.businesses.create)
  const businesses = useQuery(api.businesses.listAllByCurrentUser)
  const hasBusinesses = (businesses?.length ?? 0) > 0
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<FormState>({
    name: "",
    type: "",
    description: "",
    website: "",
    google: "",
    tripadvisor: "",
    instagram: "",
    facebook: "",
    booking: "",
    yelp: "",
    city: "",
    country: "",
    phone: "",
    priceRange: "",
    cuisineInput: "",
    cuisineTags: [],
    openingHours: "",
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addCuisineTag() {
    const tag = form.cuisineInput.trim()
    if (!tag || form.cuisineTags.includes(tag)) return
    set("cuisineTags", [...form.cuisineTags, tag])
    set("cuisineInput", "")
  }

  function removeCuisineTag(tag: string) {
    set("cuisineTags", form.cuisineTags.filter((t) => t !== tag))
  }

  function canProceed() {
    if (step === 1) return form.name.trim().length > 0 && form.type !== ""
    return true
  }

  async function handleSubmit() {
    if (!form.name || !form.type) return
    setIsSubmitting(true)
    try {
      const socialLinks = {
        instagram: form.instagram || undefined,
        facebook: form.facebook || undefined,
        tripadvisor: form.tripadvisor || undefined,
        google: form.google || undefined,
        booking: form.booking || undefined,
        yelp: form.yelp || undefined,
      }
      const hasSocialLinks = Object.values(socialLinks).some(Boolean)

      const id = await createBusiness({
        name: form.name,
        type: form.type as BusinessType,
        description: form.description || undefined,
        website: form.website || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        phone: form.phone || undefined,
        priceRange: (form.priceRange as PriceRange) || undefined,
        cuisineTypes: form.cuisineTags.length > 0 ? form.cuisineTags : undefined,
        openingHours: form.openingHours || undefined,
        socialLinks: hasSocialLinks ? socialLinks : undefined,
      })
      router.push(`/businesses/${id}/setup`)
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
            <p className="mt-1 text-sm text-muted-foreground">Step {step} of 4</p>
            <Separator className="mt-3" />
          </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Tell us about your business</CardTitle>
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
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Your online presence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://your-business.com"
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
                  <Label htmlFor="tripadvisor">TripAdvisor URL</Label>
                  <Input
                    id="tripadvisor"
                    type="url"
                    value={form.tripadvisor}
                    onChange={(e) => set("tripadvisor", e.target.value)}
                    placeholder="https://tripadvisor.com/…"
                  />
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>More platforms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram URL</Label>
                  <Input
                    id="instagram"
                    type="url"
                    value={form.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="https://instagram.com/…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook URL</Label>
                  <Input
                    id="facebook"
                    type="url"
                    value={form.facebook}
                    onChange={(e) => set("facebook", e.target.value)}
                    placeholder="https://facebook.com/…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking">Booking.com URL</Label>
                  <Input
                    id="booking"
                    type="url"
                    value={form.booking}
                    onChange={(e) => set("booking", e.target.value)}
                    placeholder="https://booking.com/…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yelp">Yelp URL</Label>
                  <Input
                    id="yelp"
                    type="url"
                    value={form.yelp}
                    onChange={(e) => set("yelp", e.target.value)}
                    placeholder="https://yelp.com/…"
                  />
                </div>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder="London"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                      placeholder="UK"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price range</Label>
                  <Select value={form.priceRange} onValueChange={(v) => set("priceRange", v as PriceRange)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select price range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget (€)</SelectItem>
                      <SelectItem value="mid">Mid-range (€€)</SelectItem>
                      <SelectItem value="upscale">Upscale (€€€)</SelectItem>
                      <SelectItem value="luxury">Luxury (€€€€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cuisine / tags</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.cuisineInput}
                      onChange={(e) => set("cuisineInput", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addCuisineTag() }
                      }}
                      placeholder="e.g. Italian"
                    />
                    <Button type="button" variant="outline" onClick={addCuisineTag}>Add</Button>
                  </div>
                  {form.cuisineTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {form.cuisineTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeCuisineTag(tag)}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Opening hours</Label>
                  <Textarea
                    id="hours"
                    value={form.openingHours}
                    onChange={(e) => set("openingHours", e.target.value)}
                    placeholder={"Mon–Fri: 9am–10pm\nSat–Sun: 10am–11pm"}
                    rows={3}
                  />
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>
            ) : (
              <div />
            )}
            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
                {isSubmitting ? "Creating…" : "Create business"}
              </Button>
            )}
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
