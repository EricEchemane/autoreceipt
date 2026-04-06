import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchJson } from "@/lib/fetch-json"

type Usage = {
  used: number
  limit: number
  remaining: number
  plan: string
  monthKey: string
  trackingEnabled: boolean
}

type BillingUsageResponse = {
  usage?: Usage | null
}

type BillingUsageAction = "simulate_limit" | "reset_usage"

export const billingUsageQueryKey = ["billing-usage"] as const

async function fetchBillingUsage() {
  const payload = await fetchJson<BillingUsageResponse>("/api/billing/usage")
  return payload.usage ?? null
}

async function runBillingUsageAction(action: BillingUsageAction) {
  const payload = await fetchJson<BillingUsageResponse>("/api/billing/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  })

  return payload.usage ?? null
}

export function useBillingUsageQuery() {
  return useQuery({
    queryKey: billingUsageQueryKey,
    queryFn: fetchBillingUsage,
  })
}

export function useBillingUsageActionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runBillingUsageAction,
    onSuccess(usage) {
      queryClient.setQueryData(billingUsageQueryKey, usage)
    },
  })
}
