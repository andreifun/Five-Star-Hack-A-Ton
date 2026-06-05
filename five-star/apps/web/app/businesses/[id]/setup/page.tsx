"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCurrentBusiness } from "@/components/business-context"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
} from "lucide-react"
import { Doc } from "@/convex/_generated/dataModel"

type TaskStatus = Doc<"setupTasks">["status"]

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "pending") return <Clock className="size-4 text-muted-foreground" />
  if (status === "running") return <Loader2 className="size-4 animate-spin text-blue-500" />
  if (status === "completed") return <CheckCircle2 className="size-4 text-green-500" />
  if (status === "failed") return <XCircle className="size-4 text-destructive" />
  return <SkipForward className="size-4 text-muted-foreground" />
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending:   { label: "Pending",   variant: "outline" },
    running:   { label: "Running",   variant: "default" },
    completed: { label: "Done",      variant: "secondary" },
    failed:    { label: "Failed",    variant: "destructive" },
    skipped:   { label: "Skipped",   variant: "outline" },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export default function SetupPage() {
  const { businessId } = useCurrentBusiness()
  const router = useRouter()
  const tasks = useQuery(api.setupTasks.listByBusiness, { businessId })
  const done = useQuery(api.setupTasks.allCompleted, { businessId })

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{done ? "Ready! 🎉" : "Setting up your business…"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks === undefined && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {tasks?.map((task) => (
              <div key={task._id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusIcon status={task.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{task.label}</span>
                    <StatusBadge status={task.status} />
                  </div>
                  {task.message && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{task.message}</p>
                  )}
                </div>
              </div>
            ))}
            {done && (
              <div className="pt-4">
                <Button
                  className="w-full"
                  onClick={() => router.push(`/businesses/${businessId}`)}
                >
                  Go to dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
