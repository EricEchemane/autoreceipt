"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

type CheckoutPlan = "pro" | "business"

type BillingActionsProps = {
  primaryCheckoutAction?: {
    plan: CheckoutPlan
    label: string
    enabled: boolean
  }
  secondaryCheckoutAction?: {
    plan: CheckoutPlan
    label: string
    enabled: boolean
  }
  canCancelBilling: boolean
  canResumeAction: boolean
  canRefreshStatus: boolean
}

export function BillingActions({
  primaryCheckoutAction,
  secondaryCheckoutAction,
  canCancelBilling,
  canResumeAction,
  canRefreshStatus,
}: BillingActionsProps) {
  const [pendingCheckoutPlan, setPendingCheckoutPlan] = useState<CheckoutPlan | null>(null)
  const [isCancelPending, setIsCancelPending] = useState(false)
  const [isResumePending, setIsResumePending] = useState(false)
  const [isRefreshPending, setIsRefreshPending] = useState(false)

  async function openCheckout(plan: CheckoutPlan) {
    setPendingCheckoutPlan(plan)

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      })
      const payload = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout could not start.")
      }

      window.location.href = payload.url
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Checkout failed.")
      setPendingCheckoutPlan(null)
    }
  }

  async function cancelSubscription() {
    setIsCancelPending(true)

    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Subscription could not be cancelled.")
      }

      window.location.reload()
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Subscription cancellation failed."
      )
      setIsCancelPending(false)
    }
  }

  async function resumeSubscriptionSetup() {
    setIsResumePending(true)

    try {
      const response = await fetch("/api/billing/resume", {
        method: "POST",
      })
      const payload = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Could not continue setup.")
      }

      window.location.href = payload.url
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not continue setup."
      )
      setIsResumePending(false)
    }
  }

  async function refreshStatus() {
    setIsRefreshPending(true)

    try {
      const response = await fetch("/api/billing/sync", {
        method: "POST",
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not refresh billing status.")
      }

      window.location.reload()
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Could not refresh billing status."
      )
      setIsRefreshPending(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {primaryCheckoutAction ? (
        <Button
          onClick={() => openCheckout(primaryCheckoutAction.plan)}
          disabled={
            pendingCheckoutPlan !== null || !primaryCheckoutAction.enabled
          }
        >
          {pendingCheckoutPlan === primaryCheckoutAction.plan
            ? "Starting checkout..."
            : primaryCheckoutAction.label}
        </Button>
      ) : null}
      {secondaryCheckoutAction ? (
        <Button
          variant="outline"
          onClick={() => openCheckout(secondaryCheckoutAction.plan)}
          disabled={
            pendingCheckoutPlan !== null || !secondaryCheckoutAction.enabled
          }
        >
          {pendingCheckoutPlan === secondaryCheckoutAction.plan
            ? "Starting checkout..."
            : secondaryCheckoutAction.label}
        </Button>
      ) : null}
      {canResumeAction ? (
        <Button
          variant="outline"
          onClick={resumeSubscriptionSetup}
          disabled={isResumePending}
        >
          {isResumePending ? "Opening..." : "Continue setup"}
        </Button>
      ) : null}
      {canCancelBilling ? (
        <Button
          variant="outline"
          onClick={cancelSubscription}
          disabled={isCancelPending}
        >
          {isCancelPending ? "Cancelling..." : "Cancel renewal"}
        </Button>
      ) : null}
      {canRefreshStatus ? (
        <Button
          variant="ghost"
          onClick={refreshStatus}
          disabled={isRefreshPending}
        >
          {isRefreshPending ? "Refreshing..." : "Refresh status"}
        </Button>
      ) : null}
    </div>
  )
}
