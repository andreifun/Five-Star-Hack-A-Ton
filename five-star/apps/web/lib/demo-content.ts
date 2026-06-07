import { Clock, LayoutList, ScanSearch } from "lucide-react"

export const DEMO_SLIDES = [
  {
    eyebrow: "The reality",
    title: "Reviews pile up. There's never a good time.",
    description:
      "Every week you mean to go through the feedback. Something more urgent comes up. The reviews stay unread — and the same issues keep showing up.",
    icon: Clock,
  },
  {
    eyebrow: "The fix",
    title: "We organize it. You decide what to act on.",
    description:
      "Five Star pulls your reviews together, finds the patterns, and shows you what guests are consistently saying — so you can deal with it in one focused session.",
    icon: ScanSearch,
  },
  {
    eyebrow: "What you get",
    title: "Your reviews, organized into what to do next.",
    description:
      "Themes, patterns, and priorities — pulled from every source into one workspace. Spend ten minutes, leave with a clear list.",
    icon: LayoutList,
  },
] as const
