"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, Trash2, ListTodo } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { Id } from "@/convex/_generated/dataModel"

interface AgentTodo {
  _id: Id<"agentTodos">
  title: string
  description: string
  priority: "high" | "medium" | "low"
  isCompleted: boolean
}

interface TodoPanelProps {
  todos: AgentTodo[]
  onComplete: (id: Id<"agentTodos">) => void
  onDelete: (id: Id<"agentTodos">) => void
  onExplain: (title: string, description: string) => void
}

const priorityConfig = {
  high: { label: "High", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
  medium: { label: "Med", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  low: { label: "Low", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
}

function TodoItem({
  todo,
  onComplete,
  onDelete,
  onExplain,
}: {
  todo: AgentTodo
  onComplete: (id: Id<"agentTodos">) => void
  onDelete: (id: Id<"agentTodos">) => void
  onExplain: (title: string, description: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const p = priorityConfig[todo.priority]

  function handleComplete() {
    setCompleting(true)
    onComplete(todo._id)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className="group rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={handleComplete}
          disabled={completing}
          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
          aria-label="Mark complete"
        >
          <motion.div
            animate={completing ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] } : { scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <Circle className="size-4" />
          </motion.div>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", p.className)}>
              {p.label}
            </span>
            <p className="truncate text-sm font-medium leading-snug">{todo.title}</p>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {todo.description}
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => onExplain(todo.title, todo.description)}
                    title="Ask assistant to explain"
                  >
                    <Sparkles className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(todo._id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>
    </motion.div>
  )
}

export function TodoPanel({ todos, onComplete, onDelete, onExplain }: TodoPanelProps) {
  const highCount = todos.filter((t) => t.priority === "high").length

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card/80 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ListTodo className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Action Items</span>
        {todos.length > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
            {todos.length}
          </span>
        )}
        {highCount > 0 && (
          <span className="flex h-5 items-center gap-1 rounded-full bg-red-100 px-2 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-400">
            {highCount} urgent
          </span>
        )}
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          {todos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-2 py-12 text-center"
            >
              <CheckCircle2 className="size-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No tasks yet.</p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {todos.map((todo) => (
                <TodoItem
                  key={todo._id}
                  todo={todo}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onExplain={onExplain}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
