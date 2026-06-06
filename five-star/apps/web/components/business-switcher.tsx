"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCurrentBusiness } from "./business-context"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ChevronDown, Plus } from "lucide-react"

export function BusinessSwitcher() {
  const router = useRouter()
  const { businessId, business } = useCurrentBusiness()
  const businesses = useQuery(api.businesses.listAllByCurrentUser)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="m-1 gap-1.5 border border-foreground/20 bg-foreground/10 font-semibold hover:bg-foreground/15 focus-visible:ring-0 focus-visible:border-foreground/20"
        >
          {business?.name ?? "…"}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {businesses?.map((b) => (
          <DropdownMenuItem
            key={b._id}
            onSelect={() => router.push(`/businesses/${b._id}`)}
            className={b._id === businessId ? "font-medium" : ""}
          >
            {b.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          <Plus className="mr-2 size-4" />
          Add business
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
