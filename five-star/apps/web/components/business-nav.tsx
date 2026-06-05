"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, MessageSquare, Lightbulb, Star } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { useCurrentBusiness } from "@/components/business-context"

const TABS = [
  { segment: "", label: "Dashboard", icon: LayoutDashboard },
  { segment: "reviews", label: "Reviews", icon: Star },
  { segment: "tips", label: "Tips", icon: Lightbulb },
  { segment: "chat", label: "Assistant", icon: MessageSquare },
] as const

export function BusinessNav() {
  const { businessId } = useCurrentBusiness()
  const pathname = usePathname()
  const base = `/businesses/${businessId}`

  return (
    <nav className="flex items-center gap-1">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base
        const isActive =
          tab.segment === ""
            ? pathname === base
            : pathname.startsWith(href)
        const Icon = tab.icon

        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
