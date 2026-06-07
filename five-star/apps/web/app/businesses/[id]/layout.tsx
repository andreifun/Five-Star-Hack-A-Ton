"use client"

import { use } from "react"
import { UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { Id } from "@/convex/_generated/dataModel"
import {
  BusinessProvider,
  useCurrentBusiness,
} from "@/components/business-context"
import {
  AuthGate,
  FullScreenLoader,
  StatusScreen,
} from "@/components/auth-gate"
import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { cn } from "@workspace/ui/lib/utils"

function BusinessShell({ children }: { children: React.ReactNode }) {
  const { business } = useCurrentBusiness()
  const pathname = usePathname()
  const isTipWorkspace = /^\/businesses\/[^/]+\/tips\/[^/]+$/.test(pathname)
  const isSetup = /^\/businesses\/[^/]+\/setup$/.test(pathname)

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

  if (isSetup) return children

  return (
    <div className="flex h-svh flex-col">
      <div className="relative flex shrink-0 items-center justify-start px-2 py-3 sm:justify-center sm:px-4">
        <Header />
        <div className="absolute right-2 sm:right-4">
          <UserButton />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AppSidebar />
        <div
          className={cn(
            "flex w-full min-w-0 flex-1 flex-col",
            !isTipWorkspace && "mx-auto max-w-[1000px]"
          )}
        >
          {children}
        </div>
      </div>
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
