"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Files,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Upload,
  Zap,
} from "lucide-react"

import type { StoredReceipt } from "@/lib/receipt-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const DEFAULT_PARALLEL_UPLOADS = 4
const MAX_ALLOWED_PARALLEL_UPLOADS = 8
const MIN_ALLOWED_PARALLEL_UPLOADS = 1

function resolveParallelUploads() {
  const raw = Number(process.env.NEXT_PUBLIC_MAX_PARALLEL_RECEIPTS)

  if (!Number.isFinite(raw)) {
    return DEFAULT_PARALLEL_UPLOADS
  }

  return Math.min(
    MAX_ALLOWED_PARALLEL_UPLOADS,
    Math.max(MIN_ALLOWED_PARALLEL_UPLOADS, Math.floor(raw))
  )
}

const MAX_PARALLEL_UPLOADS = resolveParallelUploads()
const RECEIPT_REQUEST_TIMEOUT_MS = 90000

const statusSteps = [
  "Waiting to start",
  "Getting receipt ready",
  "Reading receipt details",
  "Saved and ready to review",
]

const loadingHighlights = [
  "Preparing large files before upload so the batch keeps moving",
  "Processing multiple receipts at once for faster turnaround",
  "Showing updates as each receipt is being read",
  "Saving finished receipts right away so you can review sooner",
]

type UploadQueueItemStatus =
  | "ready"
  | "queued"
  | "preparing"
  | "uploading"
  | "extracting"
  | "saving"
  | "done"
  | "error"

type UploadQueueItem = {
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

type ParsedSseEvent = {
  event: string
  data: unknown
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function parseSseChunk(chunk: string) {
  const eventLine = chunk
    .split("\n")
    .find((line) => line.startsWith("event: "))
    ?.slice("event: ".length)

  const dataLines = chunk
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length))

  if (!eventLine || dataLines.length === 0) {
    return null
  }

  return {
    event: eventLine,
    data: JSON.parse(dataLines.join("\n")),
  }
}

function splitSsePayload(buffer: string) {
  const events = buffer.split("\n\n")

  return {
    completeEvents: events.slice(0, -1),
    remainder: events.at(-1) ?? "",
  }
}

function createQueueItem(file: File): UploadQueueItem {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: file.size,
    status: "ready",
    progress: 0,
    streamedText: "",
    optimized: false,
    errorMessage: "",
    storedReceipt: null,
  }
}

function getStatusLabel(status: UploadQueueItemStatus) {
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

function getStatusBadgeVariant(status: UploadQueueItemStatus) {
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

function isActiveStatus(status: UploadQueueItemStatus) {
  return (
    status === "preparing" ||
    status === "uploading" ||
    status === "extracting" ||
    status === "saving"
  )
}

async function optimizeImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    return { file, wasOptimized: false }
  }

  const bitmap = await createImageBitmap(file)
  const maxDimension = 1600
  const largestSide = Math.max(bitmap.width, bitmap.height)

  if (largestSide <= maxDimension && file.size < 2 * 1024 * 1024) {
    bitmap.close()
    return { file, wasOptimized: false }
  }

  const scale = Math.min(1, maxDimension / largestSide)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")

  if (!context) {
    bitmap.close()
    return { file, wasOptimized: false }
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  })

  if (!blob) {
    return { file, wasOptimized: false }
  }

  const optimizedFile = new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + ".jpg",
    { type: "image/jpeg" }
  )

  return { file: optimizedFile, wasOptimized: true }
}

export function ReceiptPrototype() {
  const [receipts, setReceipts] = useState<StoredReceipt[]>([])
  const [selectedRecentReceiptId, setSelectedRecentReceiptId] = useState<string | null>(null)
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([])
  const [focusedUploadId, setFocusedUploadId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(true)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const recentReceiptsRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    async function loadReceipts() {
      try {
        const response = await fetch("/api/receipts")
        const payload = (await response.json()) as { receipts?: StoredReceipt[] }
        const nextReceipts = payload.receipts ?? []

        setReceipts(nextReceipts)
        setSelectedRecentReceiptId(nextReceipts[0]?.id ?? null)
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load saved receipts."
        )
      } finally {
        setIsLoadingReceipts(false)
      }
    }

    void loadReceipts()
  }, [])

  const focusedUpload = useMemo(() => {
    if (focusedUploadId) {
      const match = queueItems.find((item) => item.id === focusedUploadId)
      if (match) {
        return match
      }
    }

    return (
      queueItems.find((item) => isActiveStatus(item.status)) ??
      queueItems[0] ??
      null
    )
  }, [focusedUploadId, queueItems])

  const selectedRecentReceipt = useMemo(() => {
    if (selectedRecentReceiptId) {
      const match = receipts.find((item) => item.id === selectedRecentReceiptId)
      if (match) {
        return match
      }
    }

    return receipts[0] ?? null
  }, [receipts, selectedRecentReceiptId])

  const batchStats = useMemo(() => {
    const completed = queueItems.filter((item) => item.status === "done").length
    const failed = queueItems.filter((item) => item.status === "error").length
    const active = queueItems.filter((item) => isActiveStatus(item.status)).length
    const queued = queueItems.filter((item) => item.status === "queued").length
    const totalBytes = queueItems.reduce((sum, item) => sum + item.fileSize, 0)

    return {
      completed,
      failed,
      active,
      queued,
      totalBytes,
      count: queueItems.length,
    }
  }, [queueItems])

  const isAnalyzing = useMemo(
    () =>
      queueItems.some(
        (item) => item.status === "queued" || isActiveStatus(item.status)
      ),
    [queueItems]
  )

  const analysisProgress = useMemo(() => {
    if (queueItems.length === 0) {
      return 0
    }

    const total = queueItems.reduce((sum, item) => sum + item.progress, 0)
    return Math.round(total / queueItems.length)
  }, [queueItems])

  const activeStep = Math.min(
    Math.floor(analysisProgress / 34),
    statusSteps.length - 1
  )
  const activeHighlight =
    loadingHighlights[
    Math.min(Math.floor(analysisProgress / 25), loadingHighlights.length - 1)
    ]
  const hasSelectedReceipts = batchStats.count > 0

  const statusMessage = useMemo(() => {
    if (focusedUpload && isActiveStatus(focusedUpload.status)) {
      return `${focusedUpload.fileName}: ${getStatusLabel(focusedUpload.status)}`
    }

    if (isAnalyzing) {
      return `Processing ${batchStats.completed + batchStats.active} of ${batchStats.count} receipts`
    }

    if (batchStats.count > 0 && batchStats.completed > 0 && batchStats.failed === 0) {
      return `Finished ${batchStats.completed} receipts in the latest batch`
    }

    if (batchStats.failed > 0) {
      return `Batch finished with ${batchStats.failed} receipt errors`
    }

    return "Upload one or more receipts to start processing."
  }, [batchStats, focusedUpload, isAnalyzing])

  function updateQueueItem(
    id: string,
    updater: (item: UploadQueueItem) => UploadQueueItem
  ) {
    setQueueItems((current) =>
      current.map((item) => (item.id === id ? updater(item) : item))
    )
  }

  function jumpToRecentReceipts() {
    window.requestAnimationFrame(() => {
      recentReceiptsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  async function processQueueItem(job: UploadQueueItem) {
    setFocusedUploadId(job.id)
    updateQueueItem(job.id, (item) => ({
      ...item,
      status: "preparing",
      progress: 8,
      streamedText: "",
      errorMessage: "",
      optimized: false,
    }))

    try {
      const { file: uploadFile, wasOptimized } = await optimizeImageForUpload(job.file)

      updateQueueItem(job.id, (item) => ({
        ...item,
        optimized: wasOptimized,
        status: "uploading",
        progress: 18,
      }))

      const formData = new FormData()
      formData.append("file", uploadFile)

      const requestController = new AbortController()
      const timeoutId = window.setTimeout(() => {
        requestController.abort("Receipt extraction timed out.")
      }, RECEIPT_REQUEST_TIMEOUT_MS)

      const response = await fetch("/api/receipts/extract", {
        method: "POST",
        body: formData,
        signal: requestController.signal,
      })

      window.clearTimeout(timeoutId)

      if (!response.ok) {
        let message = "Receipt extraction failed."

        try {
          const errorPayload = (await response.json()) as { error?: string }
          if (errorPayload.error) {
            message = errorPayload.error
          }
        } catch { }

        throw new Error(message)
      }

      if (!response.body) {
        throw new Error("Streaming response body is unavailable.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let sawReceiptEvent = false
      let sawDoneEvent = false

      const handleEvent = (parsedEvent: ParsedSseEvent) => {
        if (parsedEvent.event === "status") {
          const statusData = parsedEvent.data as {
            stage?: string
            progress: number
          }

          if (statusData.stage === "finalizing") {
            updateQueueItem(job.id, (item) => ({
              ...item,
              status: "saving",
              progress: statusData.progress,
            }))
          } else {
            updateQueueItem(job.id, (item) => ({
              ...item,
              status: "uploading",
              progress: Math.max(item.progress, statusData.progress),
            }))
          }
        }

        if (parsedEvent.event === "text_delta") {
          const textDeltaData = parsedEvent.data as {
            progress: number
            snapshot: string
          }

          updateQueueItem(job.id, (item) => ({
            ...item,
            status: "extracting",
            progress: Math.min(
              Math.max(item.progress, textDeltaData.progress),
              85
            ),
            streamedText: textDeltaData.snapshot,
          }))
        }

        if (parsedEvent.event === "receipt") {
          const receiptData = parsedEvent.data as {
            receipt: StoredReceipt
            duplicate?: boolean
          }
          const nextReceipt = receiptData.receipt

          sawReceiptEvent = true

          updateQueueItem(job.id, (item) => ({
            ...item,
            status: "done",
            progress: 100,
            storedReceipt: nextReceipt,
            errorMessage: receiptData.duplicate
              ? "Duplicate prevented. Using the existing saved receipt."
              : "",
          }))

          setReceipts((current) => [
            nextReceipt,
            ...current.filter((savedReceipt) => savedReceipt.id !== nextReceipt.id),
          ])
          setSelectedRecentReceiptId(nextReceipt.id)
          jumpToRecentReceipts()
        }

        if (parsedEvent.event === "done") {
          sawDoneEvent = true
        }

        if (parsedEvent.event === "error") {
          const errorData = parsedEvent.data as { message?: string }
          throw new Error(errorData.message ?? "Receipt extraction failed.")
        }
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          buffer += decoder.decode()

          const finalChunk = buffer.trim()
          if (finalChunk.length > 0) {
            const parsedEvent = parseSseChunk(finalChunk)
            if (parsedEvent) {
              handleEvent(parsedEvent)
            }
          }

          break
        }

        buffer += decoder.decode(value, { stream: true })
        const { completeEvents, remainder } = splitSsePayload(buffer)
        buffer = remainder

        for (const rawEvent of completeEvents) {
          const parsedEvent = parseSseChunk(rawEvent)

          if (!parsedEvent) {
            continue
          }
          handleEvent(parsedEvent)
        }
      }

      if (!sawReceiptEvent) {
        const completionHint = sawDoneEvent
          ? "The stream ended with done but no receipt payload."
          : "The stream ended before completion."
        throw new Error(completionHint)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Receipt request timed out. Please retry this file."
            : error.message
          : "Receipt extraction failed."

      updateQueueItem(job.id, (item) => ({
        ...item,
        status: "error",
        progress: 100,
        errorMessage: message,
      }))
    }
  }

  async function runAnalysis() {
    if (queueItems.length === 0) {
      setErrorMessage("Choose one or more receipt files first.")
      return
    }

    setErrorMessage("")

    const pendingJobs = queueItems
      .filter((item) => item.status !== "done")
      .map((item) => ({
        ...item,
        status: "queued" as const,
        progress: 0,
        streamedText: "",
        errorMessage: "",
        optimized: false,
      }))

    if (pendingJobs.length === 0) {
      return
    }

    setQueueItems((current) =>
      current.map((item) =>
        item.status === "done"
          ? item
          : {
            ...item,
            status: "queued",
            progress: 0,
            streamedText: "",
            errorMessage: "",
            optimized: false,
          }
      )
    )

    setFocusedUploadId(pendingJobs[0]?.id ?? null)

    let nextJobIndex = 0

    await Promise.all(
      Array.from(
        { length: Math.min(MAX_PARALLEL_UPLOADS, pendingJobs.length) },
        async () => {
          while (nextJobIndex < pendingJobs.length) {
            const job = pendingJobs[nextJobIndex]
            nextJobIndex += 1

            if (!job) {
              break
            }

            await processQueueItem(job)
          }
        }
      )
    )
  }

  return (
    <main className="relative min-h-svh overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-background" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="min-w-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit">
                Built for Real Bookkeeping Work
              </Badge>
              <Button size="sm" variant="outline" asChild>
                <Link href="/receipts">Open receipts</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/insights">Open summary</Link>
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              <CardTitle className="max-w-3xl text-4xl leading-tight sm:text-5xl">
                Turn receipt photos into clean, review-ready expense records.
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                Designed for business owners, bookkeepers, and finance staff who
                need faster month-end cleanup. Upload receipts in batch, extract key
                fields, and review categorized line items before posting to books.
              </CardDescription>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricCard
              icon={Files}
              label="Batch speed"
              value={`${MAX_PARALLEL_UPLOADS} receipts at the same time`}
              detail="Keeps processing fast and steady for real bookkeeping work."
            />
            <MetricCard
              icon={ShieldCheck}
              label="Review checks"
              value="You stay in control"
              detail="Check merchant, tax, and line details before final posting."
            />
            <MetricCard
              icon={ArrowUpRight}
              label="Record history"
              value="Original + organized details"
              detail="Each record keeps both the original receipt and organized data."
            />
          </div>
        </section>

        <section className="grid gap-4 rounded-[2rem] border bg-card/70 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1">
              <Badge variant="secondary" className="w-fit">
                Processing workspace
              </Badge>
              <CardTitle className="text-2xl">Upload, process, and follow the batch live</CardTitle>
              <CardDescription className="max-w-2xl">
                Keep file intake, progress, and live extraction details in one working area.
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {batchStats.count === 0
                ? "No batch started yet"
                : `${batchStats.completed} completed • ${batchStats.active} active • ${batchStats.failed} failed`}
            </div>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="min-w-0">
              <div className="flex flex-col gap-6">
                <div className="gap-4 rounded-3xl border border-dashed border-border bg-muted/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Upload className="size-4 text-primary" />
                      Upload receipt images or PDFs
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">Start here</Badge>
                      Choose files first, then run analysis
                    </div>
                    <label className="flex w-full cursor-pointer flex-col gap-4 rounded-[1.75rem] border border-primary/35 bg-background px-4 py-4 text-sm shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/55 sm:px-5 sm:py-5">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <Upload className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-base font-semibold text-foreground">
                              {hasSelectedReceipts
                                ? `${batchStats.count} receipt${batchStats.count === 1 ? "" : "s"} selected`
                                : "Click to upload your receipts"}
                            </span>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                              Drag in images or PDFs for weekly reimbursements and month-end bookkeeping runs.
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={hasSelectedReceipts ? "success" : "outline"}
                          className="w-fit px-3 py-1"
                        >
                          {hasSelectedReceipts ? "Ready to analyze" : "Primary action"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-background/80 px-3 py-1.5 shadow-sm">
                          {hasSelectedReceipts
                            ? `${batchStats.count} files · ${formatFileSize(batchStats.totalBytes)}`
                            : "PNG, JPG, WEBP, or PDF"}
                        </span>
                        <span className="rounded-full bg-background/80 px-3 py-1.5 shadow-sm">
                          Large images are auto-optimized before upload
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          const nextQueueItems = files.map(createQueueItem)

                          setQueueItems(nextQueueItems)
                          setFocusedUploadId(nextQueueItems[0]?.id ?? null)
                          setErrorMessage("")
                        }}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                      <span className="rounded-full bg-background px-3 py-1">
                        Up to {MAX_PARALLEL_UPLOADS} receipts processed at once
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 sm:gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFocusedUploadId(queueItems[0]?.id ?? null)
                        setErrorMessage("")
                      }}
                      disabled={queueItems.length === 0}
                    >
                      Focus list
                    </Button>
                    <Button
                      onClick={runAnalysis}
                      disabled={isAnalyzing || queueItems.length === 0}
                      className={cn(
                        "shadow-sm ring-1 transition-all",
                        hasSelectedReceipts
                          ? "selected-action-glow border-primary/30 ring-primary/35 hover:ring-primary/55"
                          : "ring-primary/20 hover:ring-primary/35"
                      )}
                    >
                      <ScanSearch data-icon="inline-start" />
                      {isAnalyzing
                        ? "Analyzing batch..."
                        : `Analyze ${batchStats.count || ""} receipt${batchStats.count === 1 ? "" : "s"}`.trim()}
                    </Button>
                  </div>
                </div>

                <Card className="border-border bg-card shadow-none">
                  <CardContent className="flex flex-col gap-5 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative flex size-11 items-center justify-center rounded-2xl border bg-muted">
                          {isAnalyzing ? (
                            <LoaderCircle className="size-5 animate-spin" />
                          ) : (
                            <FileSearch className="size-5" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium">
                            {isAnalyzing ? "Working on your receipts" : "Batch ready"}
                          </span>
                          <span className="text-sm text-muted-foreground break-words">
                            {statusMessage}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          batchStats.failed > 0 && !isAnalyzing ? "destructive" : analysisProgress === 100 && batchStats.count > 0 ? "success" : "warning"
                        }
                        className="w-fit border-0 sm:self-start"
                      >
                        {batchStats.count === 0
                          ? "No batch yet"
                          : `${analysisProgress}% overall`}
                      </Badge>
                    </div>
                    <Progress value={analysisProgress} />
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      <SignalTile
                        icon={Zap}
                        label="In progress"
                        value={`${batchStats.active}/${MAX_PARALLEL_UPLOADS} receipts active`}
                      />
                      <SignalTile
                        icon={ScanSearch}
                        label="Current update"
                        value={activeHighlight}
                      />
                      <SignalTile
                        icon={TimerReset}
                        label="Batch progress"
                        value={`${batchStats.completed} done · ${batchStats.queued} waiting`}
                      />
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      {statusSteps.map((step, index) => (
                        <div
                          key={step}
                          className={cn(
                            "flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all",
                            index <= activeStep
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border bg-muted/30"
                          )}
                        >
                          <div
                            className={cn(
                              "size-2.5 rounded-full",
                              index <= activeStep ? "bg-primary" : "bg-muted-foreground/50"
                            )}
                          />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {queueItems.length > 0 ? (
                  <div className="grid min-w-0 gap-2 rounded-3xl border bg-background p-2 sm:p-3">
                    {queueItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex w-full flex-col items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-4",
                          focusedUpload?.id === item.id
                            ? "border-primary/40 bg-background text-foreground shadow-sm"
                            : "border-border hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={() => setFocusedUploadId(item.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {item.fileName}
                            </span>
                            {item.optimized ? (
                              <Badge variant="outline">Optimized</Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatFileSize(item.fileSize)}
                          </div>
                          <Progress value={item.progress} className="mt-3 h-1.5" />
                        </div>
                        <div className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                          <Badge variant={getStatusBadgeVariant(item.status)}>
                            {getStatusLabel(item.status)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.progress}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="min-w-0">
              <Card className="border-border shadow-none">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <CardTitle className="text-2xl">Live receipt details</CardTitle>
                      <CardDescription>
                        Follow the selected receipt while we read and save it.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTechnicalDetails((current) => !current)}
                    >
                      {showTechnicalDetails ? (
                        <ChevronUp data-icon="inline-start" />
                      ) : (
                        <ChevronDown data-icon="inline-start" />
                      )}
                      {showTechnicalDetails ? "Hide detailed view" : "Show detailed view"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <Sparkles className="size-4" />
                      <span className="truncate">Live updates</span>
                    </div>
                    <Badge variant="outline" className="max-w-full truncate sm:max-w-56">
                      {focusedUpload ? focusedUpload.fileName : "No selected receipt"}
                    </Badge>
                  </div>
                  {showTechnicalDetails ? (
                    <>
                      {focusedUpload && isActiveStatus(focusedUpload.status) ? (
                        <AnimatedReceiptLoader
                          progress={focusedUpload.progress}
                          statusMessage={`${focusedUpload.fileName}: ${getStatusLabel(focusedUpload.status)}`}
                          activeHighlight={activeHighlight}
                        />
                      ) : null}
                      <div className="relative min-h-80 min-w-0 overflow-hidden rounded-3xl border bg-muted/35 p-4">
                        {focusedUpload && isActiveStatus(focusedUpload.status) ? (
                          <div className="receipt-scan-line absolute inset-x-4 top-0 h-20" />
                        ) : null}
                        <pre className="overflow-x-auto font-mono text-xs leading-6 text-foreground whitespace-pre-wrap break-words">
                          {focusedUpload?.streamedText ||
                            '{\n  "message": "No live update yet."\n}'}
                        </pre>
                      </div>
                      {errorMessage ? (
                        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                          {errorMessage}
                        </div>
                      ) : null}
                      {focusedUpload?.errorMessage ? (
                        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                          {focusedUpload.errorMessage}
                        </div>
                      ) : (
                        <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                          Select a receipt in the list to see progress and results.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl border bg-muted/35 p-4">
                      {focusedUpload && isActiveStatus(focusedUpload.status) ? (
                        <AnimatedReceiptLoader
                          progress={focusedUpload.progress}
                          statusMessage={`${focusedUpload.fileName}: ${getStatusLabel(focusedUpload.status)}`}
                          activeHighlight={activeHighlight}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Detailed view is hidden. You can open it anytime to see live updates.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </section>

        <section ref={recentReceiptsRef}>
          <Card className="border-border">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Recent receipts</CardTitle>
                <CardDescription>
                  Quick view of your latest saved receipts.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {isLoadingReceipts ? "Loading..." : `${receipts.length} saved`}
                </Badge>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/receipts">Open full receipts page</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid pt-2 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-x-auto rounded-2xl border border-r-0 rounded-r-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.length > 0 ? (
                      receipts.slice(0, 6).map((savedReceipt) => (
                        <TableRow
                          key={savedReceipt.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedRecentReceipt?.id === savedReceipt.id && "bg-accent/45"
                          )}
                          onClick={() => setSelectedRecentReceiptId(savedReceipt.id)}
                        >
                          <TableCell className="font-medium">
                            {savedReceipt.merchantName || "Unknown merchant"}
                          </TableCell>
                          <TableCell>{savedReceipt.purchaseDate || "Unknown"}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(savedReceipt.totalAmountDue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              onClick={(event) => event.stopPropagation()}
                            >
                              <a
                                href={savedReceipt.sourceFileUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open file
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No receipts saved yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div
                className={cn(
                  "rounded-2xl border border-l-0 rounded-l-none p-4",
                  selectedRecentReceipt ? "border-primary/10 bg-accent/45" : "bg-muted/20"
                )}
              >
                {selectedRecentReceipt ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold">
                      {selectedRecentReceipt.merchantName || "Unknown merchant"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        TIN: {selectedRecentReceipt.tinNumber || "Not found"}
                      </Badge>
                      <Badge variant="secondary">
                        Receipt #: {selectedRecentReceipt.officialReceiptNumber || "Not found"}
                      </Badge>
                      <Badge variant="secondary">
                        VAT: {formatCurrency(selectedRecentReceipt.vatAmount)}
                      </Badge>
                    </div>
                    <div className="rounded-xl border bg-background/85 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                        Line items
                      </p>
                      <div className="grid gap-2">
                        {selectedRecentReceipt.items.slice(0, 4).map((item, index) => (
                          <div
                            key={`${item.description}-${index}`}
                            className="flex items-start justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                Qty {item.quantity} · {item.category || "Uncategorized"}
                              </p>
                            </div>
                            <span className="shrink-0 font-medium">
                              {formatCurrency(item.price)}
                            </span>
                          </div>
                        ))}
                        {selectedRecentReceipt.items.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No line items found.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a receipt row to view a quick snapshot.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 flex flex-col gap-3 sm:mt-8 lg:mt-10">
          <Separator />
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="w-fit">
              Why teams choose AutoReceipt
            </Badge>
            <CardTitle className="text-2xl sm:text-3xl">
              Built for everyday bookkeeping work
            </CardTitle>
            <CardDescription>
              Keep records clean, complete, and ready for posting with less manual effort.
            </CardDescription>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-background px-3 py-2 text-sm">
            Secure file storage
          </div>
          <div className="rounded-xl border bg-background px-3 py-2 text-sm">
            Full receipt history
          </div>
          <div className="rounded-xl border bg-background px-3 py-2 text-sm">
            Duplicate detection
          </div>
          <div className="rounded-xl border bg-background px-3 py-2 text-sm">
            Export-ready records
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">Step 1</Badge>
              <CardTitle className="text-xl">Upload receipts</CardTitle>
              <CardDescription>
                Add image or PDF receipts in one batch.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">Step 2</Badge>
              <CardTitle className="text-xl">Review and confirm</CardTitle>
              <CardDescription>
                Check merchant, tax, and line details before posting.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">Step 3</Badge>
              <CardTitle className="text-xl">Export and post</CardTitle>
              <CardDescription>
                Export clean records and complete bookkeeping faster.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Designed for real teams</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-xl border px-3 py-3">
                <p className="text-sm font-medium">Business owners</p>
                <p className="text-sm text-muted-foreground">Track expenses without manual entry.</p>
              </div>
              <div className="rounded-xl border px-3 py-3">
                <p className="text-sm font-medium">Bookkeepers</p>
                <p className="text-sm text-muted-foreground">Review and correct receipts quickly.</p>
              </div>
              <div className="rounded-xl border px-3 py-3">
                <p className="text-sm font-medium">Finance teams</p>
                <p className="text-sm text-muted-foreground">Maintain clean records for month-end closing.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common questions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-xl border px-3 py-3">
                <p className="text-sm font-medium">What files are supported?</p>
                <p className="text-sm text-muted-foreground">PNG, JPG, WEBP, and PDF receipts.</p>
              </div>
              <div className="rounded-xl border px-3 py-3">
                <p className="text-sm font-medium">Can I fix receipt details?</p>
                <p className="text-sm text-muted-foreground">Yes. Use the receipts page to review and update records.</p>
              </div>
              <div className="rounded-xl border px-3 py-3">
                <p className="text-sm font-medium">How are duplicates handled?</p>
                <p className="text-sm text-muted-foreground">Possible duplicates are flagged for quick checking.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl sm:text-3xl">
                Ready to clean up your receipt workflow?
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Start with a batch upload, then manage everything from the receipts page.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/receipts">Open receipts</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/insights">Open summary</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function AnimatedReceiptLoader({
  progress,
  statusMessage,
  activeHighlight,
}: {
  progress: number
  statusMessage: string
  activeHighlight: string
}) {
  return (
    <div className="grid gap-4 rounded-3xl border bg-muted/35 p-4 md:grid-cols-[0.85fr_1.15fr]">
      <div className="relative overflow-hidden rounded-[1.5rem] border bg-linear-to-br from-card to-amber-50/40 p-4">
        <div className="receipt-scan-line absolute inset-x-0 top-0 h-16" />
        <div className="receipt-float flex h-full flex-col gap-3 rounded-[1.2rem] border border-dashed border-primary/20 bg-muted/35 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Reading receipt
            </div>
            <LoaderCircle className="size-4 animate-spin text-primary" />
          </div>
          <div className="h-3 w-2/3 rounded-full bg-muted" />
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="h-2 w-5/6 rounded-full bg-muted" />
          <div className="h-2 w-4/6 rounded-full bg-muted" />
          <div className="mt-3 grid gap-2">
            {[52, 84, 68, 91].map((width, index) => (
              <div
                key={width}
                className="flex items-center justify-between rounded-2xl bg-linear-to-r from-muted/80 to-amber-50/55 px-3 py-2"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div
                  className="h-2 rounded-full bg-muted-foreground/30"
                  style={{ width: `${width}%` }}
                />
                <div className="ml-3 h-2 w-10 rounded-full bg-primary/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          {statusMessage}
        </div>
        <div className="rounded-2xl bg-linear-to-r from-amber-500/10 via-background to-emerald-500/10 p-3 text-sm text-muted-foreground">
          {activeHighlight}
        </div>
        <div className="grid gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="receipt-shimmer flex items-center gap-3 overflow-hidden rounded-2xl border bg-card px-3 py-3"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="size-8 rounded-2xl bg-primary/15" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-2 w-2/3 rounded-full bg-muted-foreground/25" />
                <div className="h-2 w-1/2 rounded-full bg-muted-foreground/15" />
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Progress {progress}%
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Sparkles
  label: string
  value: string
  detail: string
}) {
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

function SignalTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border bg-muted/35 p-3">
      <div className="flex items-center gap-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground break-words">{value}</div>
    </div>
  )
}
