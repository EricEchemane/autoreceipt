import Link from "next/link"
import { ArrowRight, ArrowUpRight, Files, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

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
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="w-fit">
            Built for Real Bookkeeping Work
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.95fr)] lg:items-stretch">
          <div className="flex h-full flex-col gap-5">
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

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="#workspace">
                  Try the workspace
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/receipts">See saved receipts</Link>
              </Button>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              {metricCards.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
            </div>
          </div>

          <Card className="h-full border-border bg-card/70 shadow-none">
            <CardHeader className="gap-3">
              <Badge variant="secondary" className="w-fit">
                Why teams switch
              </Badge>
              <CardTitle className="text-2xl">
                Faster intake. Safer review. Cleaner records.
              </CardTitle>
              <CardDescription className="leading-7">
                AutoReceipt helps teams move from scattered receipt photos to a
                working review flow without the usual month-end bottleneck.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3">
                <ProofLine label="Batch upload for month-end cleanup" />
                <ProofLine label="Review merchant, tax, and line items before posting" />
                <ProofLine label="Duplicate checks before saving" />
                <ProofLine label="Saved receipt history stays organized" />
              </div>
              <Separator />
              <div className="text-sm leading-6 text-muted-foreground">
                Start with the workspace below, then continue into saved receipts
                when the batch is complete.
              </div>
            </CardContent>
          </Card>
        </div>
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
    <Card className="h-full border-border bg-card/70 shadow-none">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Icon className="size-4" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="text-xl font-semibold">{value}</div>
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function ProofLine({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-background/70 px-4 py-3">
      <div className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ArrowUpRight className="size-3.5" />
      </div>
      <p className="text-sm leading-6 text-foreground">{label}</p>
    </div>
  )
}
