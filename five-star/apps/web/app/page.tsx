"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AuthGate, FullScreenLoader } from "@/components/auth-gate"

function Home() {
  const businesses = useQuery(api.businesses.listAllByCurrentUser)
  const router = useRouter()

  useEffect(() => {
    if (businesses === undefined) return
    if (businesses.length === 0) {
      router.replace("/onboarding")
    } else {
      router.replace(`/businesses/${businesses[0]!._id}`)
    }
  }, [businesses, router])

  return <FullScreenLoader />
}

export default function Page() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  )
}
