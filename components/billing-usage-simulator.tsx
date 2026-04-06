"use client"

import { CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useBillingUsageActionMutation,
  useBillingUsageQuery,
} from "@/lib/queries/billing-usage"
import { cn } from "@/lib/utils"

export function BillingUsageSimulator({ devMode }: { devMode: boolean }) {
  const usageQuery = useBillingUsageQuery()
  const usageActionMutation = useBillingUsageActionMutation()
  const usage = usageQuery.data ?? null
  const isLoading = usageQuery.isLoading
  const isRefreshing = usageQuery.isFetching && !isLoading
  const isPending = usageActionMutation.isPending
  const [feedbackMessage, setFeedbackMessage] = useState("")

  useEffect(() => {
    if (!feedbackMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFeedbackMessage("")
    }, 2800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedbackMessage])

  async function runAction(action: "simulate_limit" | "reset_usage") {
    try {
      await usageActionMutation.mutateAsync(action)
      setFeedbackMessage(
        action === "simulate_limit"
          ? "Usage updated to the current limit."
          : "Monthly usage has been reset."
      )
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Action failed.")
    }
  }

  if (isLoading) {
    return <BillingUsageSkeleton />
  }

  if (!usage) {
    return null
  }

  return (
    <div className="rounded-xl border bg-muted/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">This month</Badge>
          <span className="text-sm text-muted-foreground">
            {usage.used}/{usage.limit} receipts used ({usage.remaining} left)
          </span>
        </div>
        <div className="min-h-6 text-sm text-muted-foreground">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              Refreshing usage...
            </span>
          ) : null}
        </div>
      </div>
      {feedbackMessage ? (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-300"
          )}
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="size-4" />
          <span>{feedbackMessage}</span>
        </div>
      ) : null}
      {!usage.trackingEnabled ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Usage meter table is missing. Run <code>pnpm db:migrate</code> first.
        </p>
      ) : null}
      {devMode ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !usage.trackingEnabled}
            onClick={() => runAction("simulate_limit")}
          >
            {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Simulate limit reached
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !usage.trackingEnabled}
            onClick={() => runAction("reset_usage")}
          >
            {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Reset monthly usage
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function BillingUsageSkeleton() {
  return (
    <div className="rounded-xl border bg-muted/35 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-52 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  )
}
