"use client"

import { createContext, useContext } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id, Doc } from "@/convex/_generated/dataModel"

interface BusinessContextValue {
  businessId: Id<"businesses">
  business: (Doc<"businesses"> & { metrics: Doc<"businessMetrics"> | null }) | null | undefined
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function BusinessProvider({
  businessId,
  children,
}: {
  businessId: Id<"businesses">
  children: React.ReactNode
}) {
  const business = useQuery(api.businesses.getById, { businessId }) as
    | (Doc<"businesses"> & { metrics: Doc<"businessMetrics"> | null })
    | null
    | undefined

  return (
    <BusinessContext.Provider value={{ businessId, business }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useCurrentBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error("useCurrentBusiness must be used inside BusinessProvider")
  return ctx
}
