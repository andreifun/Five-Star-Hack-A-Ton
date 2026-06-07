"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Star, ListTodo } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { useCurrentBusiness } from "@/components/business-context"

const TABS = [
  { segment: "", label: "Dashboard", icon: LayoutDashboard },
  { segment: "reviews", label: "Reviews", icon: Star },
  { segment: "todos", label: "To Do", icon: ListTodo },
] as const

export function BusinessNav({ mobile = false }: { mobile?: boolean }) {
  const { businessId } = useCurrentBusiness()
  const pathname = usePathname()
  const base = `/businesses/${businessId}`

  return (
    <nav
      className={mobile ? "grid grid-cols-4 gap-1" : "grid gap-1"}
      aria-label="Business navigation"
    >
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base
        const isActive =
          tab.segment === "" ? pathname === base : pathname.startsWith(href)
        const Icon = tab.icon

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              mobile && "flex-col gap-1 px-1 py-1.5 text-[10px]",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4 transition-colors",
                isActive ? "text-primary" : "group-hover:text-foreground"
              )}
            />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
