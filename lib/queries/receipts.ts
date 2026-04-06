import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchJson } from "@/lib/fetch-json"
import type { StoredReceipt } from "@/lib/receipt-schema"

type ReceiptsResponse = {
  receipts?: StoredReceipt[]
}

type UpdateReceiptsInput = {
  ids: string[]
  reviewStatus?: StoredReceipt["reviewStatus"]
  category?: string
}

export const receiptsQueryKey = ["receipts"] as const

async function fetchReceipts() {
  const payload = await fetchJson<ReceiptsResponse>("/api/receipts")
  return payload.receipts ?? []
}

async function updateReceipts(input: UpdateReceiptsInput) {
  const payload = await fetchJson<ReceiptsResponse>("/api/receipts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  return payload.receipts ?? []
}

export function useReceiptsQuery() {
  return useQuery({
    queryKey: receiptsQueryKey,
    queryFn: fetchReceipts,
  })
}

export function useUpdateReceiptsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateReceipts,
    onSuccess(receipts) {
      queryClient.setQueryData(receiptsQueryKey, receipts)
    },
  })
}
