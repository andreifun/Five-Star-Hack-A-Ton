"use client"

import { use } from "react"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Id } from "@/convex/_generated/dataModel"
import {
  BusinessProvider,
  useCurrentBusiness,
} from "@/components/business-context"
import { BusinessSwitcher } from "@/components/business-switcher"
import { BusinessNav } from "@/components/business-nav"
import { AuthGate, FullScreenLoader, StatusScreen } from "@/components/auth-gate"
import { Logo } from "@/components/logo"

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
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="h-6" />
          <BusinessSwitcher />
        </div>
        {!isSetup && <BusinessNav />}
        <UserButton />
      </header>
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
