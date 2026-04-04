"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Usage = {
  used: number
  limit: number
  remaining: number
  plan: string
  monthKey: string
  trackingEnabled: boolean
}

export function BillingUsageSimulator({ devMode }: { devMode: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function loadUsage() {
    const response = await fetch("/api/billing/usage")
    const payload = (await response.json()) as { usage?: Usage }
    setUsage(payload.usage ?? null)
  }

  useEffect(() => {
    void loadUsage()
  }, [])

  async function runAction(action: "simulate_limit" | "reset_usage") {
    setIsPending(true)
    try {
      const response = await fetch("/api/billing/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const payload = (await response.json()) as { usage?: Usage; error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed.")
      }

      setUsage(payload.usage ?? null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Action failed.")
    } finally {
      setIsPending(false)
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
