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

type EditReceiptInput = {
  id: string
  merchantName: string
  tinNumber: string
  officialReceiptNumber: string
  purchaseDate: string
  totalAmountDue: number
  taxableSales: number
  vatAmount: number
  notes: string
  reviewStatus: StoredReceipt["reviewStatus"]
  category: string
}

type EditReceiptResponse = {
  receipt?: StoredReceipt
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

async function editReceipt({ id, ...input }: EditReceiptInput) {
  const payload = await fetchJson<EditReceiptResponse>(`/api/receipts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!payload.receipt) {
    throw new Error("Could not update receipt.")
  }

  return payload.receipt
}

export function useEditReceiptMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: editReceipt,
    onSuccess(receipt) {
      queryClient.setQueryData<StoredReceipt[]>(receiptsQueryKey, (current = []) =>
        current.map((entry) => (entry.id === receipt.id ? receipt : entry))
      )
    },
  })
}
