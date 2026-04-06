import { ArrowUpRight, Files, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"

import { type MetricCardDefinition } from "./shared"

type HomeHeroSectionProps = {
  maxParallelUploads: number
}

export function HomeHeroSection({
  maxParallelUploads,
}: HomeHeroSectionProps) {
  const metricCards: MetricCardDefinition[] = [
    {
      icon: Files,
      label: "Batch speed",
      value: `${maxParallelUploads} receipts at the same time`,
      detail: "Keeps processing fast and steady for real bookkeeping work.",
    },
    {
      icon: ShieldCheck,
      label: "Review checks",
      value: "You stay in control",
      detail: "Check merchant, tax, and line details before final posting.",
    },
    {
      icon: ArrowUpRight,
      label: "Record history",
      value: "Original + organized details",
      detail: "Each record keeps both the original receipt and organized data.",
    },
  ]

  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="w-fit">
            Built for Real Bookkeeping Work
          </Badge>
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Turn receipt photos into clean, review-ready expense records.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Designed for business owners, bookkeepers, and finance staff who
            need faster month-end cleanup. Upload receipts in batch, extract key
            fields, and review categorized line items before posting to books.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: MetricCardDefinition) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  )
}
