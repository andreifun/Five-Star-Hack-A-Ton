"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useQuery, usePaginatedQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useCurrentBusiness } from "@/components/business-context"
import { Badge } from "@workspace/ui/components/badge"
import { CATEGORY_LABELS, PRIORITY_BADGE } from "@/lib/format"
import { Check, Loader2, ArrowUpRight } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

type Tip = Doc<"tips">
type AgentTodo = Doc<"agentTodos">

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<string, number> = { in_progress: 0, pending: 1, done: 2, dismissed: 3 }

function TodoItem({ todo }: { todo: AgentTodo }) {
  const complete = useMutation(api.agentTodos.complete)
  const remove = useMutation(api.agentTodos.remove)

  return (
    <div className={cn("flex items-start gap-3 py-2", todo.isCompleted && "opacity-50")}>
      <button
        onClick={() => todo.isCompleted ? remove({ id: todo._id }) : complete({ id: todo._id })}
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          todo.isCompleted
            ? "border-muted-foreground/30 bg-muted-foreground/20 text-muted-foreground"
            : "border-muted-foreground/40 hover:border-foreground hover:bg-muted"
        )}
        title={todo.isCompleted ? "Remove" : "Mark done"}
      >
        {todo.isCompleted && <Check className="size-2.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", todo.isCompleted && "line-through")}>{todo.title}</p>
        {todo.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{todo.description}</p>
        )}
      </div>
      <Badge variant={PRIORITY_BADGE[todo.priority]} className="shrink-0 text-[10px]">
        {todo.priority}
      </Badge>
    </div>
  )
}

function TipRow({ tip, todos }: { tip: Tip; todos: AgentTodo[] }) {
  const { businessId } = useCurrentBusiness()
  const hasTodos = todos.length > 0
  const pendingTodos = todos.filter((t) => !t.isCompleted)
  const completedTodos = todos.filter((t) => t.isCompleted)

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={PRIORITY_BADGE[tip.priority]} className="text-[10px]">{tip.priority}</Badge>
            <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[tip.category]}</Badge>
            {tip.status === "in_progress" && (
              <Badge variant="default" className="text-[10px]">In progress</Badge>
            )}
            {tip.status === "done" && (
              <Badge variant="secondary" className="text-[10px]">Done</Badge>
            )}
            {tip.status === "dismissed" && (
              <Badge variant="outline" className="text-[10px] opacity-60">Dismissed</Badge>
            )}
          </div>
          <p className="text-sm font-medium leading-snug">{tip.title}</p>
          <p className="text-xs text-muted-foreground">{tip.content}</p>
        </div>
        <Link
          href={`/businesses/${businessId}/tips/${tip._id}`}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Open tip workspace"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {hasTodos && (
        <div className="border-t px-4 pb-3">
          <p className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subtasks {pendingTodos.length > 0 && `· ${pendingTodos.length} open`}
          </p>
          <div className="divide-y">
            {pendingTodos.map((todo) => (
              <TodoItem key={todo._id} todo={todo} />
            ))}
            {completedTodos.map((todo) => (
              <TodoItem key={todo._id} todo={todo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TodosPage() {
  const { businessId } = useCurrentBusiness()

  const tips = usePaginatedQuery(api.tips.listByBusiness, { businessId }, { initialNumItems: 200 })
  const todos = useQuery(api.agentTodos.listAllByBusiness, { businessId })

  const { activeTips, doneTips, dismissedTips, todosByTipId } = useMemo(() => {
    const todosByTipId = new Map<string, AgentTodo[]>()
    for (const todo of todos ?? []) {
      if (!todo.tipId) continue
      const list = todosByTipId.get(todo.tipId) ?? []
      list.push(todo)
      todosByTipId.set(todo.tipId, list)
    }

    const sorted = [...(tips.results ?? [])].sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4)
      if (statusDiff !== 0) return statusDiff
      return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    })

    return {
      activeTips: sorted.filter((t) => t.status === "pending" || t.status === "in_progress"),
      doneTips: sorted.filter((t) => t.status === "done"),
      dismissedTips: sorted.filter((t) => t.status === "dismissed"),
      todosByTipId,
    }
  }, [tips.results, todos])

  const isLoading = tips.status === "LoadingFirstPage" || todos === undefined

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold">To Do</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All improvement issues ordered by priority, with generated subtasks.
          </p>
        </div>

        {activeTips.length === 0 && doneTips.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No tips yet. Generate some from the dashboard.
          </p>
        ) : (
          <>
            {activeTips.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active · {activeTips.length}
                </h2>
                {activeTips.map((tip) => (
                  <TipRow key={tip._id} tip={tip} todos={todosByTipId.get(tip._id) ?? []} />
                ))}
              </section>
            )}

            {doneTips.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Done · {doneTips.length}
                </h2>
                {doneTips.map((tip) => (
                  <TipRow key={tip._id} tip={tip} todos={todosByTipId.get(tip._id) ?? []} />
                ))}
              </section>
            )}

            {dismissedTips.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dismissed · {dismissedTips.length}
                </h2>
                {dismissedTips.map((tip) => (
                  <TipRow key={tip._id} tip={tip} todos={todosByTipId.get(tip._id) ?? []} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
