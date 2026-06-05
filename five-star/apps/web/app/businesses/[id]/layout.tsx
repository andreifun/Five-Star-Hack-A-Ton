"use client"

import { use } from "react"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Id } from "@/convex/_generated/dataModel"
import { BusinessProvider } from "@/components/business-context"
import { BusinessSwitcher } from "@/components/business-switcher"
import { BusinessNav } from "@/components/business-nav"

export default function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<unknown>
}) {
  const { id } = use(params) as { id: string }
  const pathname = usePathname()
  const isSetup = pathname.endsWith("/setup")

  return (
    <BusinessProvider businessId={id as Id<"businesses">}>
      <div className="flex h-svh flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <BusinessSwitcher />
          {!isSetup && <BusinessNav />}
          <UserButton />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </BusinessProvider>
  )
}
