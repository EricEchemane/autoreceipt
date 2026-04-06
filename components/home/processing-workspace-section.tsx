"use client"

import Link from "next/link"
import type { RefObject } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  ScanSearch,
  Sparkles,
  Upload,
} from "lucide-react"

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
import { cn } from "@/lib/utils"

import {
  FREE_ACCOUNT_SCAN_LIMIT,
  formatFileSize,
  getStatusBadgeVariant,
  getStatusLabel,
  isActiveStatus,
  statusSteps,
  type LimitPromptState,
  type UploadQueueItem,
} from "./shared"

type ProcessingWorkspaceSectionProps = {
  maxParallelUploads: number
  batchSummary: string
  queueItems: UploadQueueItem[]
  focusedUpload: UploadQueueItem | null
  isAnalyzing: boolean
  analysisProgress: number
  activeHighlight: string
  activeStep: number
  statusMessage: string
  errorMessage: string
  firstQueueError: string
  limitPrompt: LimitPromptState
  showDetailedView: boolean
  hasSelectedReceipts: boolean
  onFilesSelected: (files: File[]) => void
  onRunAnalysis: () => void
  onFocusList: () => void
  onFocusUpload: (uploadId: string) => void
  onDismissLimitPrompt: () => void
  onToggleDetailedView: () => void
  queueListRef: RefObject<HTMLDivElement | null>
}

export function ProcessingWorkspaceSection({
  maxParallelUploads,
  batchSummary,
  queueItems,
  focusedUpload,
  isAnalyzing,
  analysisProgress,
  activeHighlight,
  activeStep,
  statusMessage,
  errorMessage,
  firstQueueError,
  limitPrompt,
  showDetailedView,
  hasSelectedReceipts,
  onFilesSelected,
  onRunAnalysis,
  onFocusList,
  onFocusUpload,
  onDismissLimitPrompt,
  onToggleDetailedView,
  queueListRef,
}: ProcessingWorkspaceSectionProps) {
  const totalBytes = queueItems.reduce((sum, item) => sum + item.fileSize, 0)
  const completedCount = queueItems.filter((item) => item.status === "done").length
  const activeCount = queueItems.filter((item) => isActiveStatus(item.status)).length
  const failedCount = queueItems.filter((item) => item.status === "error").length

  return (
    <section
      id="workspace"
      className="grid gap-4 rounded-[2rem] border bg-card/70 p-4 shadow-sm sm:p-6 scroll-mt-20"
    >
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
        <div className="text-sm text-muted-foreground">{batchSummary}</div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
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
                            ? `${queueItems.length} receipt${queueItems.length === 1 ? "" : "s"} selected`
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
                        ? `${queueItems.length} files · ${formatFileSize(totalBytes)}`
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
                    onChange={(event) => onFilesSelected(Array.from(event.target.files ?? []))}
                  />
                </label>
                <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-background px-3 py-1">
                    Up to {maxParallelUploads} receipts processed at once
                  </span>
                </div>

                {(errorMessage || firstQueueError) && !limitPrompt ? (
                  <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {errorMessage || firstQueueError}
                  </div>
                ) : null}

                {limitPrompt ? (
                  <div
                    className={cn(
                      "mb-4 rounded-2xl border px-4 py-3 text-sm shadow-sm",
                      limitPrompt.code === "GUEST_LIMIT_REACHED"
                        ? "border-orange-200/80 bg-orange-50/80 text-orange-950 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-100"
                        : "border-orange-300/80 bg-orange-100/70 text-orange-950 dark:border-orange-800/60 dark:bg-orange-950/30 dark:text-orange-100"
                    )}
                  >
                    <Badge
                      variant="secondary"
                      className={cn(
                        "mb-3 border px-2.5 py-0.5 text-[11px] font-medium",
                        limitPrompt.code === "GUEST_LIMIT_REACHED"
                          ? "border-orange-200/80 bg-background/80 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-200"
                          : "border-orange-300/80 bg-background/80 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-200"
                      )}
                    >
                      {limitPrompt.code === "GUEST_LIMIT_REACHED"
                        ? "Free trial complete"
                        : "Plan limit reached"}
                    </Badge>
                    <p className="font-medium text-foreground">
                      {limitPrompt.code === "GUEST_LIMIT_REACHED"
                        ? "Free trial limit reached"
                        : "Monthly limit reached"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {limitPrompt.code === "GUEST_LIMIT_REACHED"
                        ? `You've used all ${limitPrompt.limit} free receipt scans. Create an account to continue.`
                        : `You have used ${limitPrompt.used} of ${limitPrompt.limit} receipts on your ${limitPrompt.plan} plan this month.`}
                    </p>
                    {limitPrompt.code === "GUEST_LIMIT_REACHED" ? (
                      <p className="mt-1 text-muted-foreground">
                        Free accounts can scan up to {FREE_ACCOUNT_SCAN_LIMIT} receipts each month.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {limitPrompt.code === "GUEST_LIMIT_REACHED" ? (
                        <Button size="sm" asChild>
                          <Link href="/sign-up">Create free account</Link>
                        </Button>
                      ) : (
                        <Button size="sm" asChild>
                          <Link href="/billing">Upgrade plan</Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={onDismissLimitPrompt}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-between gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  onClick={onFocusList}
                  disabled={queueItems.length === 0}
                >
                  Focus list
                </Button>
                <Button
                  onClick={onRunAnalysis}
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
                    : `Analyze ${queueItems.length || ""} receipt${queueItems.length === 1 ? "" : "s"}`.trim()}
                </Button>
              </div>
            </div>

            {queueItems.length > 0 && !isAnalyzing ? (
              <div
                ref={queueListRef}
                className="grid min-w-0 gap-1.5 rounded-3xl border bg-background p-2 sm:p-2.5"
              >
                {queueItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors sm:px-3.5 sm:py-3",
                      focusedUpload?.id === item.id
                        ? "border-primary/40 bg-background text-foreground shadow-sm"
                        : "border-border hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => onFocusUpload(item.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.fileName}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatFileSize(item.fileSize)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.optimized ? (
                          <Badge variant="outline" className="px-2 py-0 text-[10px]">
                            Optimized
                          </Badge>
                        ) : null}
                        <Badge
                          variant={getStatusBadgeVariant(item.status)}
                          className="px-2.5 py-0.5 text-[10px]"
                        >
                          {getStatusLabel(item.status)}
                        </Badge>
                      </div>
                    </div>

                    {item.errorMessage ? (
                      <div className="text-[11px] leading-5 text-destructive">
                        {item.errorMessage}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                      <span>{item.errorMessage ? "Needs attention" : "Progress"}</span>
                      <span className="shrink-0">
                        {item.progress}%
                      </span>
                    </div>
                    <Progress value={item.progress} className="h-1.5 w-full" />
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
                  <CardTitle className="text-2xl">Batch monitor</CardTitle>
                  <CardDescription>
                    Follow the selected receipt while keeping batch progress and live
                    details in one place.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleDetailedView}
                >
                  {showDetailedView ? (
                    <ChevronUp data-icon="inline-start" />
                  ) : (
                    <ChevronDown data-icon="inline-start" />
                  )}
                  {showDetailedView
                    ? "Hide technical details"
                    : "Show technical details"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-3xl border bg-muted/25 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex size-11 items-center justify-center rounded-2xl border bg-muted">
                      <LoaderCircle
                        className={cn(
                          "size-5",
                          isAnalyzing ? "animate-spin" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {isAnalyzing ? "Working on your receipts" : "Batch ready"}
                      </span>
                      <span className="wrap-break-word text-sm text-muted-foreground">
                        {statusMessage}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      failedCount > 0 && !isAnalyzing
                        ? "destructive"
                        : analysisProgress === 100 && queueItems.length > 0
                          ? "success"
                          : "warning"
                    }
                    className="w-fit border-0 sm:self-start"
                  >
                    {queueItems.length === 0 ? "No batch yet" : `${analysisProgress}% overall`}
                  </Badge>
                </div>
                <Progress value={analysisProgress} className="mt-4" />
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MonitorStat
                    label="Current stage"
                    value={statusSteps[activeStep] ?? "Waiting to start"}
                  />
                  <MonitorStat
                    label="Active receipts"
                    value={`${activeCount}/${maxParallelUploads} in progress`}
                  />
                  <MonitorStat
                    label="Batch progress"
                    value={`${completedCount} done · ${failedCount} failed`}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles className="size-4" />
                  <span className="truncate">Technical details</span>
                </div>
                <Badge variant="outline" className="max-w-full truncate sm:max-w-56">
                  {focusedUpload ? focusedUpload.fileName : "No selected receipt"}
                </Badge>
              </div>
              <div className="rounded-2xl border bg-muted/35 p-4">
                <p className="text-sm text-muted-foreground">
                  {focusedUpload
                    ? "Use the full-width loader above to monitor the selected receipt while this panel keeps the underlying extraction payload available."
                    : "Select a receipt in the list while a batch is running to inspect its technical extraction details."}
                </p>
              </div>
              {showDetailedView ? (
                <div className="relative min-h-72 min-w-0 overflow-hidden rounded-3xl border bg-muted/35 p-4">
                  {focusedUpload && isActiveStatus(focusedUpload.status) ? (
                    <div className="receipt-scan-line absolute inset-x-4 top-0 h-20" />
                  ) : null}
                  <pre className="wrap-break-word overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-foreground">
                    {focusedUpload?.streamedText ||
                      '{\n  "message": "No live update yet."\n}'}
                  </pre>
                </div>
              ) : null}
              {errorMessage ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}
              {focusedUpload?.errorMessage ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {focusedUpload.errorMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      {focusedUpload && isActiveStatus(focusedUpload.status) ? (
        <AnimatedReceiptLoader
          progress={focusedUpload.progress}
          statusMessage={`${focusedUpload.fileName}: ${getStatusLabel(focusedUpload.status)}`}
          activeHighlight={activeHighlight}
          queueItems={queueItems}
          focusedUploadId={focusedUpload.id}
        />
      ) : null}
    </section>
  )
}

export function AnimatedReceiptLoader({
  progress,
  statusMessage,
  activeHighlight,
  queueItems,
  focusedUploadId,
}: {
  progress: number
  statusMessage: string
  activeHighlight: string
  queueItems: UploadQueueItem[]
  focusedUploadId: string
}) {
  const relatedQueueItems = queueItems
    .filter((item) => item.id !== focusedUploadId)
    .slice(0, 4)

  return (
    <div className="grid gap-5 rounded-3xl border bg-muted/20 p-5 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:p-6">
      <div className="relative min-h-84 overflow-hidden rounded-[1.75rem] border bg-linear-to-br from-card to-amber-50/35 p-5">
        <div className="receipt-scan-line absolute inset-x-0 top-0 h-16" />
        <div className="receipt-float flex h-full flex-col gap-4 rounded-[1.35rem] border border-dashed border-primary/20 bg-muted/30 p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Reading receipt
            </div>
            <LoaderCircle className="size-4 animate-spin text-primary" />
          </div>
          <div className="h-3 w-2/3 rounded-full bg-muted" />
          <div className="h-2.5 w-full rounded-full bg-muted" />
          <div className="h-2.5 w-5/6 rounded-full bg-muted" />
          <div className="h-2.5 w-4/6 rounded-full bg-muted" />
          <div className="mt-4 grid gap-3">
            {[52, 84, 68, 91].map((width, index) => (
              <div
                key={width}
                className="flex items-center justify-between rounded-2xl bg-linear-to-r from-muted/80 to-amber-50/55 px-3 py-2.5"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div
                  className="h-2.5 rounded-full bg-muted-foreground/30"
                  style={{ width: `${width}%` }}
                />
                <div className="ml-3 h-2.5 w-11 rounded-full bg-primary/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          {statusMessage}
        </div>
        <div className="rounded-3xl bg-linear-to-r from-amber-500/10 via-background to-emerald-500/10 p-4 text-sm leading-7 text-muted-foreground">
          {activeHighlight}
        </div>
        <div className="grid gap-3">
          {relatedQueueItems.length > 0 ? (
            relatedQueueItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-4 overflow-hidden rounded-2xl border bg-card px-4 py-4"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <LoaderCircle
                    className={cn(
                      "size-4",
                      isActiveStatus(item.status)
                        ? "animate-spin text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.fileName}
                    </p>
                    <Badge variant={getStatusBadgeVariant(item.status)}>
                      {getStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={item.progress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {item.progress}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border bg-card px-4 py-4 text-sm text-muted-foreground">
              No other receipts are waiting in this batch.
            </div>
          )}
        </div>
        <div className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Progress {progress}%
        </div>
      </div>
    </div>
  )
}

function MonitorStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border bg-background/70 p-3">
      <div className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 wrap-break-word text-sm text-foreground">{value}</div>
    </div>
  )
}
