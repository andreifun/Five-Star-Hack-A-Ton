"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { TipsKanbanCard, type MockTip } from "@/components/tips-kanban-card"
import { TIP_STATUS_LABELS } from "@/lib/format"

type Status = MockTip["status"]
const COLUMNS: Status[] = ["pending", "in_progress", "done", "dismissed"]

const MOCK_TIPS: MockTip[] = [
  {
    id: "t1",
    title: "Respond to all negative reviews within 24 hours to improve trust",
    priority: "high",
    category: "communication",
    status: "pending",
    actions: [
      { id: "a1", text: "Set up review alert notifications" },
      { id: "a2", text: "Draft response templates for common complaints" },
      { id: "a3", text: "Assign review owner on the team" },
    ],
  },
  {
    id: "t2",
    title: "Add seasonal menu items to attract repeat guests",
    priority: "medium",
    category: "menu",
    status: "pending",
    actions: [
      { id: "a4", text: "Research seasonal ingredients in region" },
      { id: "a5", text: "Pilot 2 new dishes in next week's service" },
    ],
  },
  {
    id: "t3",
    title: "Deep clean common areas and restrooms on a daily schedule",
    priority: "high",
    category: "cleanliness",
    status: "pending",
    actions: [
      { id: "a6", text: "Create daily cleaning checklist" },
      { id: "a7", text: "Assign dedicated cleaning staff per area" },
    ],
  },
  {
    id: "t4",
    title: "Train staff on upselling techniques to increase revenue per visit",
    priority: "medium",
    category: "staff",
    status: "in_progress",
    actions: [
      { id: "a8", text: "Schedule training session for front-of-house" },
      { id: "a9", text: "Prepare upselling scripts and examples" },
      { id: "a10", text: "Track revenue impact over 30 days" },
    ],
  },
  {
    id: "t5",
    title: "Improve ambient lighting for a warmer dining atmosphere",
    priority: "low",
    category: "ambiance",
    status: "in_progress",
    actions: [
      { id: "a11", text: "Research warm-tone lighting options" },
      { id: "a12", text: "Get quotes from 3 lighting suppliers" },
    ],
  },
  {
    id: "t6",
    title: "Implement a loyalty points program for returning customers",
    priority: "medium",
    category: "marketing",
    status: "done",
    actions: [
      { id: "a13", text: "Choose loyalty platform" },
      { id: "a14", text: "Configure reward tiers" },
      { id: "a15", text: "Launch email campaign to existing customers" },
    ],
  },
  {
    id: "t7",
    title: "Introduce contactless payment to speed up checkout",
    priority: "low",
    category: "operations",
    status: "done",
    actions: [
      { id: "a16", text: "Update POS terminals" },
      { id: "a17", text: "Train staff on new payment flow" },
    ],
  },
  {
    id: "t8",
    title: "Offer complimentary welcome drink to boost first impressions",
    priority: "low",
    category: "service",
    status: "dismissed",
    actions: [{ id: "a18", text: "Calculate cost per drink per table" }],
  },
]

type DragState = {
  tip: MockTip
  cursorX: number
  cursorY: number
  offsetX: number
  offsetY: number
  cardWidth: number
  cardHeight: number
  hoverColumn: Status | null
  hoverIndex: number
}

export function TipsKanbanModal() {
  const router = useRouter()
  const [tips, setTips] = useState<MockTip[]>(MOCK_TIPS)
  const [drag, setDrag] = useState<DragState | null>(null)

  // Mutable refs to avoid stale closures in window event listeners
  const dragRef = useRef<DragState | null>(null)
  const tipsRef = useRef<MockTip[]>(tips)
  const columnRefs = useRef<Map<Status, HTMLDivElement>>(new Map())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    tipsRef.current = tips
  }, [tips])

  function sync(state: DragState | null) {
    dragRef.current = state
    setDrag(state)
  }

  function getColumnAt(x: number, y: number): Status | null {
    for (const [status, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return status
      }
    }
    return null
  }

  function getInsertIndex(column: Status, y: number, dragId: string): number {
    const col = tipsRef.current.filter(
      (t) => t.status === column && t.id !== dragId,
    )
    for (let i = 0; i < col.length; i++) {
      const el = cardRefs.current.get(col[i]!.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (y < rect.top + rect.height / 2) return i
    }
    return col.length
  }

  // Attach window-level listeners only while dragging so fast mouse moves don't drop
  useEffect(() => {
    if (!drag) return

    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const col = getColumnAt(e.clientX, e.clientY)
      const index = col
        ? getInsertIndex(col, e.clientY, d.tip.id)
        : d.hoverIndex
      sync({ ...d, cursorX: e.clientX, cursorY: e.clientY, hoverColumn: col, hoverIndex: index })
    }

    function onUp() {
      const d = dragRef.current
      if (!d) return
      if (d.hoverColumn) {
        const { tip, hoverColumn, hoverIndex } = d
        setTips((prev) => {
          const dragged = { ...tip, status: hoverColumn }
          const rest = prev.filter((t) => t.id !== tip.id)
          const same = rest.filter((t) => t.status === hoverColumn)
          const other = rest.filter((t) => t.status !== hoverColumn)
          return [
            ...other,
            ...same.slice(0, hoverIndex),
            dragged,
            ...same.slice(hoverIndex),
          ]
        })
      }
      sync(null)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [drag?.tip.id]) // re-attach only when a new card starts dragging

  function handleMouseDown(tip: MockTip, e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    // Initial hover index = the card's current position in its column
    const colTips = tips.filter((t) => t.status === tip.status)
    const tipIdx = colTips.findIndex((t) => t.id === tip.id)
    const filteredIdx = Math.min(tipIdx, colTips.length - 1)

    sync({
      tip,
      cursorX: e.clientX,
      cursorY: e.clientY,
      offsetX,
      offsetY,
      cardWidth: rect.width,
      cardHeight: rect.height,
      hoverColumn: tip.status,
      hoverIndex: filteredIdx,
    })
  }

  // Build the item list for each column, injecting a placeholder at hover position
  function getColumnItems(status: Status) {
    if (!drag) {
      return tips
        .filter((t) => t.status === status)
        .map((t) => ({ type: "tip" as const, data: t }))
    }

    const colTips = tips
      .filter((t) => t.status === status && t.id !== drag.tip.id)
      .map((t) => ({ type: "tip" as const, data: t }))

    if (drag.hoverColumn === status) {
      return [
        ...colTips.slice(0, drag.hoverIndex),
        { type: "placeholder" as const },
        ...colTips.slice(drag.hoverIndex),
      ]
    }

    return colTips
  }

  // Tilt direction based on where the cursor grabbed the card
  const rotation = drag ? ((drag.offsetX / drag.cardWidth) - 0.5) * 8 : 0

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 py-4 border-b">
          <DialogTitle>Improvement tips — Kanban</DialogTitle>
        </DialogHeader>

        <div
          className="flex min-h-0 flex-1 overflow-x-auto"
          style={{ userSelect: drag ? "none" : undefined }}
        >
          {COLUMNS.map((status, i) => {
            const items = getColumnItems(status)
            const count = tips.filter((t) => t.status === status).length
            const isPending = status === "pending"

            const cardList = (
              <>
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    if (item.type === "placeholder") {
                      return (
                        <motion.div
                          key="placeholder"
                          layout
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: drag?.cardHeight ?? 88, opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="shrink-0 rounded-xl border border-dashed"
                        />
                      )
                    }
                    return (
                      <motion.div
                        key={item.data.id}
                        layout
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        ref={(el) => {
                          if (el) cardRefs.current.set(item.data.id, el)
                          else cardRefs.current.delete(item.data.id)
                        }}
                        onMouseDown={(e) => handleMouseDown(item.data, e)}
                        style={{ cursor: "grab" }}
                      >
                        <TipsKanbanCard tip={item.data} />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {count === 0 && !drag && (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No tips
                  </div>
                )}
              </>
            )

            return (
              <>
                {i === 1 && <div key={`sep-${status}`} className="w-px shrink-0 self-stretch bg-border" />}
                <div
                  key={status}
                  ref={(el) => {
                    if (el) columnRefs.current.set(status, el)
                    else columnRefs.current.delete(status)
                  }}
                  className={isPending ? "flex min-h-0 min-w-[280px] flex-[2] flex-col gap-2 p-4" : "flex min-h-0 flex-1 min-w-[180px] flex-col gap-2 p-4"}
                >
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium">{TIP_STATUS_LABELS[status]}</span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {cardList}
                </div>
                </div>
              </>
            )
          })}
        </div>

        {/* Portalled to body so dialog's CSS transform doesn't offset the card */}
        {createPortal(
          <AnimatePresence>
            {drag && (
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
            )}
          </AnimatePresence>,
          document.body,
        )}
      </DialogContent>
    </Dialog>
  )
}
