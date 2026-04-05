"use client"

import { startTransition, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import type { StoredReceipt } from "@/lib/receipt-schema"

import { ProcessingWorkspaceSection } from "@/components/home/processing-workspace-section"
import {
  loadingHighlights,
  ParsedSseEvent,
  RECEIPT_REQUEST_TIMEOUT_MS,
  resolveParallelUploads,
  type LimitPromptState,
  type UploadQueueItem,
  isActiveStatus,
} from "@/components/home/shared"

const MAX_PARALLEL_UPLOADS = resolveParallelUploads()

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

export function ProcessingWorkspace() {
  const router = useRouter()

  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([])
  const [focusedUploadId, setFocusedUploadId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [limitPrompt, setLimitPrompt] = useState<LimitPromptState>(null)
  const [showDetailedView, setShowDetailedView] = useState(false)
  const queueListRef = useRef<HTMLDivElement | null>(null)

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

  const batchStats = useMemo(() => {
    const completed = queueItems.filter((item) => item.status === "done").length
    const failed = queueItems.filter((item) => item.status === "error").length
    const active = queueItems.filter((item) => isActiveStatus(item.status)).length
    const queued = queueItems.filter((item) => item.status === "queued").length

    return {
      completed,
      failed,
      active,
      queued,
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

  const activeStep = Math.min(Math.floor(analysisProgress / 34), 3)
  const activeHighlight =
    loadingHighlights[
      Math.min(Math.floor(analysisProgress / 25), loadingHighlights.length - 1)
    ]
  const hasSelectedReceipts = batchStats.count > 0

  const statusMessage = useMemo(() => {
    if (focusedUpload && isActiveStatus(focusedUpload.status)) {
      return `${focusedUpload.fileName}: ${focusedUpload.status === "extracting" ? "Reading" : focusedUpload.status === "saving" ? "Saving" : focusedUpload.status === "uploading" ? "Sending" : "Getting ready"}`
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

  const firstQueueError = useMemo(
    () => queueItems.find((item) => item.status === "error")?.errorMessage ?? "",
    [queueItems]
  )

  const batchSummary =
    batchStats.count === 0
      ? "No batch started yet"
      : `${batchStats.completed} completed • ${batchStats.active} active • ${batchStats.failed} failed`

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
      document.getElementById("recent-receipts")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })

    startTransition(() => {
      router.refresh()
    })
  }

  function focusQueueList() {
    window.requestAnimationFrame(() => {
      queueListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })

      const firstButton = queueListRef.current?.querySelector<HTMLButtonElement>(
        'button[type="button"]'
      )

      firstButton?.focus({ preventScroll: true })
    })
  }

  function handleFilesSelected(files: File[]) {
    const nextQueueItems = files.map(createQueueItem)

    setQueueItems(nextQueueItems)
    setFocusedUploadId(nextQueueItems[0]?.id ?? null)
    setErrorMessage("")
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
          const errorPayload = (await response.json()) as {
            error?: string
            code?: "MONTHLY_LIMIT_REACHED" | "GUEST_LIMIT_REACHED"
            usage?: {
              used?: number
              limit?: number
              plan?: string
            }
          }

          if (
            (errorPayload.code === "MONTHLY_LIMIT_REACHED" ||
              errorPayload.code === "GUEST_LIMIT_REACHED") &&
            errorPayload.usage?.used !== undefined &&
            errorPayload.usage?.limit !== undefined
          ) {
            setLimitPrompt({
              used: errorPayload.usage.used,
              limit: errorPayload.usage.limit,
              plan: errorPayload.usage.plan ?? "free",
              code: errorPayload.code,
            })
          }

          if (errorPayload.error) {
            message = errorPayload.error
          }
        } catch {}

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
      setErrorMessage(message)
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
    <ProcessingWorkspaceSection
      maxParallelUploads={MAX_PARALLEL_UPLOADS}
      batchSummary={batchSummary}
      queueItems={queueItems}
      focusedUpload={focusedUpload}
      isAnalyzing={isAnalyzing}
      analysisProgress={analysisProgress}
      activeHighlight={activeHighlight}
      activeStep={activeStep}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      firstQueueError={firstQueueError}
      limitPrompt={limitPrompt}
      showDetailedView={showDetailedView}
      hasSelectedReceipts={hasSelectedReceipts}
      onFilesSelected={handleFilesSelected}
      onRunAnalysis={runAnalysis}
      onFocusList={() => {
        setFocusedUploadId(queueItems[0]?.id ?? null)
        setErrorMessage("")
        focusQueueList()
      }}
      onFocusUpload={setFocusedUploadId}
      onDismissLimitPrompt={() => setLimitPrompt(null)}
      onToggleDetailedView={() => setShowDetailedView((current) => !current)}
      queueListRef={queueListRef}
    />
  )
}
