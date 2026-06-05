"use client"

import { useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { api } from "@/convex/_generated/api"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function UserSync() {
  const { isAuthenticated } = useConvexAuth()
  const upsertUser = useMutation(api.users.upsertCurrentUser)

  useEffect(() => {
    if (isAuthenticated) {
      upsertUser({})
    }
  }, [isAuthenticated, upsertUser])

  return null
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSync />
      {children}
    </ConvexProviderWithClerk>
  )
}
