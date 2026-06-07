"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useCurrentBusiness } from "./business-context"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { ChevronDown, Plus, Trash2 } from "lucide-react"

export function BusinessSwitcher() {
  const router = useRouter()
  const { businessId, business } = useCurrentBusiness()
  const businesses = useQuery(api.businesses.listAllByCurrentUser)
  const removeBusiness = useMutation(api.businesses.remove)

  const [pendingDelete, setPendingDelete] = useState<{
    id: Id<"businesses">
    name: string
  } | null>(null)

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    await removeBusiness({ businessId: pendingDelete.id })
    setPendingDelete(null)
    // Navigate away if the deleted business was the current one
    if (pendingDelete.id === businessId) {
      const remaining = businesses?.filter((b) => b._id !== pendingDelete.id)
      if (remaining && remaining.length > 0) {
        router.push(`/businesses/${remaining[0]!._id}`)
      } else {
        router.push("/onboarding")
      }
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="m-1 max-w-[calc(100vw-4.5rem)] gap-1.5 border border-foreground/20 bg-foreground/10 font-semibold hover:bg-foreground/15 focus-visible:border-foreground/20 focus-visible:ring-0 sm:max-w-64"
          >
            <span className="truncate">{business?.name ?? "…"}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {businesses?.map((b) => (
            <DropdownMenuItem
              key={b._id}
              className={`group flex items-center justify-between pr-1 ${b._id === businessId ? "font-medium" : ""}`}
              onSelect={() => router.push(`/businesses/${b._id}`)}
            >
              <span className="truncate">{b.name}</span>
              <button
                className="ml-2 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setPendingDelete({ id: b._id, name: b.name })
                }}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={`Delete ${b.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
            <Plus className="mr-2 size-4" />
            Add business
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete &ldquo;{pendingDelete?.name}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              This will remove the business from your account. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
