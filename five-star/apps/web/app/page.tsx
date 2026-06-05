"use client"

import { useQuery, useConvexAuth } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function Page() {
  const { isAuthenticated } = useConvexAuth()
  const businesses = useQuery(
    api.businesses.listAllByCurrentUser,
    isAuthenticated ? {} : "skip",
  )
  const router = useRouter()

  useEffect(() => {
    if (businesses === undefined) return
    if (businesses.length === 0) {
      router.replace("/onboarding")
    } else {
      router.replace(`/businesses/${businesses[0]!._id}`)
    }
  }, [businesses, router])

  return (
    <div className="flex h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
