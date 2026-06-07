"use client"

import { useAction, useMutation, useQuery } from "convex/react"
import { Streamdown } from "streamdown"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Check, Circle, ExternalLink, FileSearch, Mail, Send, Trash2 } from "lucide-react"

export function ConversationArtifacts({ businessId, tipId }: { businessId: Id<"businesses">; tipId: Id<"tips"> }) {
  const todos = useQuery(api.agentTodos.listByTip, { businessId, tipId }) ?? []
  const reports = useQuery(api.researchReports.listByTip, { businessId, tipId }) ?? []
  const drafts = useQuery(api.emailDrafts.listByTip, { businessId, tipId }) ?? []
  const completeTodo = useMutation(api.agentTodos.complete)
  const removeTodo = useMutation(api.agentTodos.remove)
  const approveDraft = useMutation(api.emailDrafts.approve)
  const sendDraft = useAction(api.ai.email.send)

  if (todos.length === 0 && reports.length === 0 && drafts.length === 0) return null

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <article key={report._id} className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <FileSearch className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">{report.query}</p>
            <Badge variant="outline" className="ml-auto">{report.status}</Badge>
          </div>
          {report.summary ? <div className="mt-3 text-sm"><Streamdown>{report.summary}</Streamdown></div> : null}
          {report.error ? <p className="mt-2 text-xs text-destructive">{report.error}</p> : null}
          {report.sources.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {report.sources.map((source, index) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  [{index + 1}] {source.title}<ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          ) : null}
        </article>
      ))}

      {drafts.map((draft) => (
        <article key={draft._id} className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Email draft</p>
            <Badge variant="outline" className="ml-auto">{draft.status}</Badge>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <p><span className="text-muted-foreground">To:</span> {draft.recipients.join(", ") || "No recipients"}</p>
            <p><span className="text-muted-foreground">Subject:</span> {draft.subject}</p>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{draft.body}</p>
          </div>
          <div className="mt-3 flex gap-2">
            {draft.status === "draft" || draft.status === "failed" ? (
              <Button size="sm" variant="outline" onClick={() => approveDraft({ draftId: draft._id, recipients: draft.recipients, subject: draft.subject, body: draft.body })}>
                <Check className="size-3.5" />Approve final draft
              </Button>
            ) : null}
            {draft.status === "approved" ? (
              <Button size="sm" onClick={() => sendDraft({ draftId: draft._id })}>
                <Send className="size-3.5" />Send
              </Button>
            ) : null}
          </div>
          {draft.error ? <p className="mt-2 text-xs text-destructive">{draft.error}</p> : null}
        </article>
      ))}

      {todos.length > 0 ? (
        <article className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Action items</p>
          <div className="space-y-2">
            {todos.map((todo) => (
              <div key={todo._id} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
                <button onClick={() => completeTodo({ id: todo._id })} className="mt-0.5 text-muted-foreground hover:text-foreground" aria-label="Complete todo"><Circle className="size-4" /></button>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{todo.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{todo.description}</p></div>
                <button onClick={() => removeTodo({ id: todo._id })} className="text-muted-foreground hover:text-destructive" aria-label="Delete todo"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </div>
  )
}
