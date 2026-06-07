"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { TipsKanbanCard } from "@/components/tips-kanban-card"
import { TIP_STATUS_LABELS } from "@/lib/format"

type Tip = Doc<"tips">
type Status = Tip["status"]
const COLUMNS: Status[] = ["pending", "in_progress", "done", "dismissed"]

type DragState = {
  tip: Tip
  cursorX: number
  cursorY: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  cardWidth: number
  cardHeight: number
  hoverColumn: Status | null
  hoverIndex: number
  moved: boolean
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function TipsKanbanBoard({
  businessId,
  tips: persistedTips,
  activeOnly,
}: {
  businessId: Id<"businesses">
  tips: Tip[]
  activeOnly: boolean
}) {
  const router = useRouter()
  const updateStatus = useMutation(api.tips.updateStatus)
  const [tips, setTips] = useState(persistedTips)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [startingTipId, setStartingTipId] = useState<Id<"tips"> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const tipsRef = useRef(tips)
  const columnRefs = useRef<Map<Status, HTMLDivElement>>(new Map())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const hasInProgressTips = tips.some((tip) => tip.status === "in_progress")
  const columns = !hasInProgressTips
    ? COLUMNS.slice(0, 1)
    : activeOnly
      ? COLUMNS.slice(0, 2)
      : COLUMNS
  const activeDragId = drag?.tip._id

  useEffect(() => {
    if (!dragRef.current) setTips(persistedTips)
  }, [persistedTips])

  useEffect(() => {
    tipsRef.current = tips
  }, [tips])

  function sync(state: DragState | null) {
    dragRef.current = state
    setDrag(state)
  }

  function getColumnAt(x: number, y: number): Status | null {
    for (const [status, element] of columnRefs.current) {
      const rect = element.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return status
    }
    return null
  }

  function getInsertIndex(column: Status, y: number, dragId: string): number {
    const columnTips = tipsRef.current.filter((tip) => tip.status === column && tip._id !== dragId)
    for (let index = 0; index < columnTips.length; index++) {
      const element = cardRefs.current.get(columnTips[index]!._id)
      if (!element) continue
      const rect = element.getBoundingClientRect()
      if (y < rect.top + rect.height / 2) return index
    }
    return columnTips.length
  }

  useEffect(() => {
    if (!activeDragId) return

    function onMove(event: MouseEvent) {
      const current = dragRef.current
      if (!current) return
      const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 4
      const column = getColumnAt(event.clientX, event.clientY)
      const index = column ? getInsertIndex(column, event.clientY, current.tip._id) : current.hoverIndex
      sync({ ...current, cursorX: event.clientX, cursorY: event.clientY, hoverColumn: column, hoverIndex: index, moved })
    }

    function onUp() {
      const current = dragRef.current
      if (!current) return
      if (!current.moved) {
        sync(null)
        router.push(`/businesses/${businessId}/tips/${current.tip._id}`)
        return
      }
      if (current.hoverColumn) {
        const { tip, hoverColumn, hoverIndex } = current
        setTips((previous) => {
          const movedTip = { ...tip, status: hoverColumn }
          const rest = previous.filter((item) => item._id !== tip._id)
          const sameColumn = rest.filter((item) => item.status === hoverColumn)
          const otherColumns = rest.filter((item) => item.status !== hoverColumn)
          return [...otherColumns, ...sameColumn.slice(0, hoverIndex), movedTip, ...sameColumn.slice(hoverIndex)]
        })
        if (tip.status !== hoverColumn) void updateStatus({ tipId: tip._id, status: hoverColumn })
      }
      sync(null)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [activeDragId, businessId, router, updateStatus])

  function handleMouseDown(tip: Tip, event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const columnTips = tips.filter((item) => item.status === tip.status)
    const tipIndex = columnTips.findIndex((item) => item._id === tip._id)
    sync({
      tip,
      cursorX: event.clientX,
      cursorY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      cardWidth: rect.width,
      cardHeight: rect.height,
      hoverColumn: tip.status,
      hoverIndex: Math.min(tipIndex, columnTips.length - 1),
      moved: false,
    })
  }

  function sortByPriority(items: Tip[]) {
    return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
  }

  async function handleStart(tip: Tip) {
    if (startingTipId) return
    setStartingTipId(tip._id)
    setTips((previous) =>
      previous.map((item) =>
        item._id === tip._id ? { ...item, status: "in_progress" } : item,
      ),
    )
    try {
      await updateStatus({ tipId: tip._id, status: "in_progress" })
      router.push(`/businesses/${businessId}/tips/${tip._id}?start=1`)
    } catch {
      setTips((previous) =>
        previous.map((item) => (item._id === tip._id ? tip : item)),
      )
      setStartingTipId(null)
    }
  }

  function getColumnItems(status: Status) {
    const columnTips = tips.filter((tip) => tip.status === status)
    const ordered = status === "pending" ? sortByPriority(columnTips) : columnTips
    if (!drag) return ordered.map((tip) => ({ type: "tip" as const, data: tip }))
    const withoutDrag = ordered.filter((tip) => tip._id !== drag.tip._id).map((tip) => ({ type: "tip" as const, data: tip }))
    if (drag.hoverColumn !== status) return withoutDrag
    return [...withoutDrag.slice(0, drag.hoverIndex), { type: "placeholder" as const }, ...withoutDrag.slice(drag.hoverIndex)]
  }

  const rotation = drag ? (drag.offsetX / drag.cardWidth - 0.5) * 8 : 0

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 overflow-x-auto" style={{ userSelect: drag ? "none" : undefined }}>
      {columns.map((status, index) => {
        const items = getColumnItems(status)
        const count = tips.filter((tip) => tip.status === status).length
        const isPending = status === "pending"
        return (
          <div key={status} className="contents">
            {index === 1 ? <div className="w-px shrink-0 self-stretch bg-border" /> : null}
            <div
              ref={(element) => {
                if (element) columnRefs.current.set(status, element)
                else columnRefs.current.delete(status)
              }}
              className={isPending ? "flex min-h-0 min-w-[280px] flex-[2] flex-col gap-2 p-4" : "flex min-h-0 min-w-[180px] flex-1 flex-col gap-2 p-4"}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium">{TIP_STATUS_LABELS[status]}</span>
                <span className="text-sm text-muted-foreground">{count}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {items.map((item) => item.type === "placeholder" ? (
                    <motion.div key="placeholder" layout initial={{ height: 0, opacity: 0 }} animate={{ height: drag?.cardHeight ?? 88, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15, ease: "easeOut" }} className="shrink-0 rounded-xl border border-dashed" />
                  ) : (
                    <motion.div
                      key={item.data._id}
                      layout
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      ref={(element) => {
                        if (element) cardRefs.current.set(item.data._id, element)
                        else cardRefs.current.delete(item.data._id)
                      }}
                      onMouseDown={(event) => handleMouseDown(item.data, event)}
                      style={{ cursor: drag ? "grabbing" : "grab" }}
                    >
                      <TipsKanbanCard
                        tip={item.data}
                        starting={startingTipId === item.data._id}
                        onStart={() => void handleStart(item.data)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {count === 0 && !drag ? <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No tips</div> : null}
              </div>
            </div>
          </div>
        )
      })}
      {typeof document !== "undefined" ? createPortal(
        <AnimatePresence>
          {drag?.moved ? (
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: 1.04, rotate: rotation }}
              exit={{ scale: 1, rotate: 0, opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: drag.cursorX - drag.offsetX,
                top: drag.cursorY - drag.offsetY,
                width: drag.cardWidth,
                zIndex: 9999,
                pointerEvents: "none",
                transformOrigin: `${drag.offsetX}px ${drag.offsetY}px`,
                boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
              }}
            >
              <TipsKanbanCard tip={drag.tip} />
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </div>
  )
}
