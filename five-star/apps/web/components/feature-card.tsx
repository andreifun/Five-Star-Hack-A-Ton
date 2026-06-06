"use client"

import { motion } from "framer-motion"
import { cn } from "@workspace/ui/lib/utils"

interface FeatureCardProps {
  icon?: React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

export function FeatureCard({ icon, title, children, className, onClick }: FeatureCardProps) {
  return (
    <motion.div
      className={cn(
        "relative h-20 overflow-hidden rounded-2xl bg-card shadow-md ring-1 ring-foreground/10",
        onClick && "cursor-pointer",
        className,
      )}
      initial="idle"
      whileHover="hovered"
      onClick={onClick}
    >
      {/* Left content */}
      <div className="flex h-full items-center px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
            <div className="truncate text-sm font-medium leading-tight">{title}</div>
          </div>
          {children && (
            <div className="truncate text-xs text-muted-foreground">{children}</div>
          )}
        </div>
      </div>

      {/* Mini cards – tucked at bottom, rise up on hover */}
      <div className="pointer-events-none absolute right-4 top-0 h-full w-24">
        {/* Card 1 – behind: x -10px from card 2, rotate -12deg, translucent */}
        <motion.div
          className="absolute bottom-0 right-0 h-20 w-12 rounded-xl bg-card ring-1 ring-foreground/10"
          style={{ zIndex: 0, originX: "50%", originY: "100%", opacity: 0.4 }}
          variants={{
            idle:    { x: -10, y: 40, rotate: -12 },
            hovered: { x: -15, y: 22, rotate: -19 },
          }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
        />
        {/* Card 2 – front */}
        <motion.div
          className="absolute bottom-0 right-0 h-20 w-12 rounded-xl bg-card shadow-sm ring-1 ring-foreground/10"
          style={{ zIndex: 1, originX: "50%", originY: "100%" }}
          variants={{
            idle:    { x: 0, y: 32, rotate: 0 },
            hovered: { x: 4, y: 22, rotate: 7 },
          }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
        />
      </div>
    </motion.div>
  )
}
