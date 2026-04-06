"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useBillingUsageActionMutation,
  useBillingUsageQuery,
} from "@/lib/queries/billing-usage"

export function BillingUsageSimulator({ devMode }: { devMode: boolean }) {
  const usageQuery = useBillingUsageQuery()
  const usageActionMutation = useBillingUsageActionMutation()
  const usage = usageQuery.data ?? null
  const isPending = usageActionMutation.isPending

  async function runAction(action: "simulate_limit" | "reset_usage") {
    try {
      await usageActionMutation.mutateAsync(action)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Action failed.")
    }
  }

  if (!usage) {
    return null
  }

  return (
    <div className="rounded-xl border bg-muted/35 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">This month</Badge>
        <span className="text-sm text-muted-foreground">
          {usage.used}/{usage.limit} receipts used ({usage.remaining} left)
        </span>
      </div>
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
            Simulate limit reached
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !usage.trackingEnabled}
            onClick={() => runAction("reset_usage")}
          >
            Reset monthly usage
          </Button>
        </div>
      ) : null}
    </div>
  )
}
