"use client"

import Link from "next/link"
import type { RefObject } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  LoaderCircle,
  ScanSearch,
  Sparkles,
  TimerReset,
  Upload,
  Zap,
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
  const queuedCount = queueItems.filter((item) => item.status === "queued").length
  const failedCount = queueItems.filter((item) => item.status === "error").length

  return (
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
        <div className="text-sm text-muted-foreground">{batchSummary}</div>
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
                <Progress value={analysisProgress} />
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  <SignalTile
                    icon={Zap}
                    label="In progress"
                    value={`${activeCount}/${maxParallelUploads} receipts active`}
                  />
                  <SignalTile
                    icon={ScanSearch}
                    label="Current update"
                    value={activeHighlight}
                  />
                  <SignalTile
                    icon={TimerReset}
                    label="Batch progress"
                    value={`${completedCount} done · ${queuedCount} waiting`}
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
              <div
                ref={queueListRef}
                className="grid min-w-0 gap-2 rounded-3xl border bg-background p-2 sm:p-3"
              >
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
                    onClick={() => onFocusUpload(item.id)}
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
                      {item.errorMessage ? (
                        <div className="mt-1 text-xs text-destructive">
                          {item.errorMessage}
                        </div>
                      ) : null}
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
                  onClick={onToggleDetailedView}
                >
                  {showDetailedView ? (
                    <ChevronUp data-icon="inline-start" />
                  ) : (
                    <ChevronDown data-icon="inline-start" />
                  )}
                  {showDetailedView ? "Hide detailed view" : "Show detailed view"}
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
              {showDetailedView ? (
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
                    <pre className="wrap-break-word overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-foreground">
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
      <div className="mt-2 wrap-break-word text-sm text-foreground">{value}</div>
    </div>
  )
}

