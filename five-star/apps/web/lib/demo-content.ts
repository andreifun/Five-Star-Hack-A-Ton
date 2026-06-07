import { BarChart3, Lightbulb, MessageSquareText, ScanSearch } from "lucide-react"

export const DEMO_SLIDES = [
  {
    eyebrow: "The signal is already there",
    title: "Every review contains a decision waiting to happen.",
    description:
      "Hospitality teams collect hundreds of opinions across platforms, but the useful patterns stay buried in scattered comments and star ratings.",
    metric: "73%",
    metricLabel: "of customer feedback goes unactioned",
    icon: ScanSearch,
  },
  {
    eyebrow: "From noise to priorities",
    title: "Five Star turns feedback into a live operating plan.",
    description:
      "Reviews become measurable themes, prioritized improvements, and clear next actions the whole team can move forward.",
    metric: "1 view",
    metricLabel: "from review signal to execution",
    icon: Lightbulb,
  },
  {
    eyebrow: "An assistant that knows the business",
    title: "Investigate, decide, and execute without losing context.",
    description:
      "Open any opportunity and the assistant can inspect evidence, research solutions, build tasks, and prepare communications.",
    metric: "24/7",
    metricLabel: "business intelligence on demand",
    icon: MessageSquareText,
  },
] as const

export const DEMO_SETUP_STEPS = [
  { label: "Connecting review sources", icon: ScanSearch },
  { label: "Mapping customer sentiment", icon: BarChart3 },
  { label: "Prioritizing opportunities", icon: Lightbulb },
  { label: "Preparing your AI workspace", icon: MessageSquareText },
] as const

export const DEMO_SETUP_STEP_MS = 1400
