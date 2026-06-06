"use client"

import { use } from "react"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Id } from "@/convex/_generated/dataModel"
import {
  BusinessProvider,
  useCurrentBusiness,
} from "@/components/business-context"
import { BusinessNav } from "@/components/business-nav"
import { AuthGate, FullScreenLoader, StatusScreen } from "@/components/auth-gate"
import { Header } from "@/components/header"

function BusinessShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { business } = useCurrentBusiness()
  const isSetup = pathname.endsWith("/setup")

  if (business === undefined) return <FullScreenLoader />

  if (business === null) {
    return (
      <StatusScreen
        title="Business not found"
        description="This business doesn't exist or you don't have access to it."
        action={{ label: "Back to your businesses", href: "/" }}
      />
    )
  }

  return (
    <div className="flex h-svh flex-col">
      <div className="relative flex shrink-0 items-center justify-center px-4 py-3">
        <Header />
        <div className="absolute right-4">
          <UserButton />
        </div>
      </div>
      {!isSetup && <BusinessNav />}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export default function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<unknown>
}) {
  const { id } = use(params) as { id: string }

  return (
    <AuthGate>
      <BusinessProvider businessId={id as Id<"businesses">}>
        <BusinessShell>{children}</BusinessShell>
      </BusinessProvider>
    </AuthGate>
  )
}
