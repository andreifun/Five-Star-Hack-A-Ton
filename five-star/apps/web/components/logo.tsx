import { cn } from "@workspace/ui/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="Five Star"
      className={cn("h-7 w-auto dark:invert dark:hue-rotate-180", className)}
    />
  )
}
