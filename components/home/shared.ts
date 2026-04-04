import type { LucideIcon } from "lucide-react"

import type { StoredReceipt } from "@/lib/receipt-schema"

export const DEFAULT_PARALLEL_UPLOADS = 4
export const MAX_ALLOWED_PARALLEL_UPLOADS = 8
export const MIN_ALLOWED_PARALLEL_UPLOADS = 1
export const RECEIPT_REQUEST_TIMEOUT_MS = 90000
export const FREE_ACCOUNT_SCAN_LIMIT =
  Number(process.env.NEXT_PUBLIC_FREE_MONTHLY_RECEIPT_LIMIT) || 3
export const GUEST_FREE_SCAN_LIMIT =
  Number(process.env.NEXT_PUBLIC_GUEST_FREE_RECEIPT_LIMIT) || 5

export const statusSteps = [
  "Waiting to start",
  "Getting receipt ready",
  "Reading receipt details",
  "Saved and ready to review",
]

export const loadingHighlights = [
  "Preparing large files before upload so the batch keeps moving",
  "Processing multiple receipts at once for faster turnaround",
  "Showing updates as each receipt is being read",
  "Saving finished receipts right away so you can review sooner",
]

export type UploadQueueItemStatus =
  | "ready"
  | "queued"
  | "preparing"
  | "uploading"
  | "extracting"
  | "saving"
  | "done"
  | "error"

export type UploadQueueItem = {
  id: string
  file: File
  fileName: string
  fileSize: number
  status: UploadQueueItemStatus
  progress: number
  streamedText: string
  optimized: boolean
  errorMessage: string
  storedReceipt: StoredReceipt | null
}

export type LimitPromptState = {
  used: number
  limit: number
  plan: string
  code: "MONTHLY_LIMIT_REACHED" | "GUEST_LIMIT_REACHED"
} | null

export type ParsedSseEvent = {
  event: string
  data: unknown
}

export type MetricCardDefinition = {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}

export function resolveParallelUploads() {
  const raw = Number(process.env.NEXT_PUBLIC_MAX_PARALLEL_RECEIPTS)

  if (!Number.isFinite(raw)) {
    return DEFAULT_PARALLEL_UPLOADS
  }

  return Math.min(
    MAX_ALLOWED_PARALLEL_UPLOADS,
    Math.max(MIN_ALLOWED_PARALLEL_UPLOADS, Math.floor(raw))
  )
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function getStatusLabel(status: UploadQueueItemStatus) {
  switch (status) {
    case "ready":
      return "Ready"
    case "queued":
      return "Waiting"
    case "preparing":
      return "Getting ready"
    case "uploading":
      return "Sending"
    case "extracting":
      return "Reading"
    case "saving":
      return "Saving"
    case "done":
      return "Done"
    case "error":
      return "Error"
  }
}

export function getStatusBadgeVariant(status: UploadQueueItemStatus) {
  switch (status) {
    case "ready":
      return "outline" as const
    case "done":
      return "success" as const
    case "error":
      return "destructive" as const
    default:
      return "warning" as const
  }
}

export function isActiveStatus(status: UploadQueueItemStatus) {
  return (
    status === "preparing" ||
    status === "uploading" ||
    status === "extracting" ||
    status === "saving"
  )
}

