"use client"

import { useState } from "react"

import { AnimatedReceiptLoader } from "@/components/home/processing-workspace-section"
import type { UploadQueueItem } from "@/components/home/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const presetStates = [
  {
    label: "Preparing",
    progress: 12,
    statusMessage: "march-batch-001.jpg: Getting ready",
    activeHighlight: "Preparing large files before upload so the batch keeps moving",
    queueItems: buildPreviewQueueItems("preparing"),
  },
  {
    label: "Uploading",
    progress: 34,
    statusMessage: "march-batch-001.jpg: Sending",
    activeHighlight: "Processing multiple receipts at once for faster turnaround",
    queueItems: buildPreviewQueueItems("uploading"),
  },
  {
    label: "Extracting",
    progress: 67,
    statusMessage: "march-batch-001.jpg: Reading",
    activeHighlight: "Showing updates as each receipt is being read",
    queueItems: buildPreviewQueueItems("extracting"),
  },
  {
    label: "Saving",
    progress: 91,
    statusMessage: "march-batch-001.jpg: Saving",
    activeHighlight: "Saving finished receipts right away so you can review sooner",
    queueItems: buildPreviewQueueItems("saving"),
  },
]

export function AnimatedReceiptLoaderPreview() {
  const [progress, setProgress] = useState(67)
  const [statusMessage, setStatusMessage] = useState(
    "march-batch-001.jpg: Reading"
  )
  const [activeHighlight, setActiveHighlight] = useState(
    "Showing updates as each receipt is being read"
  )
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>(
    buildPreviewQueueItems("extracting")
  )

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Animated Receipt Loader Preview
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Inspect the loader in isolation and tune its copy, pacing, and visual balance
          without running a real receipt analysis.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>
              Adjust the loader state and preview the component live.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {presetStates.map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProgress(preset.progress)
                    setStatusMessage(preset.statusMessage)
                    setActiveHighlight(preset.activeHighlight)
                    setQueueItems(preset.queueItems)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Progress</span>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => setProgress(Number(event.target.value))}
              />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Status message</span>
              <Input
                value={statusMessage}
                onChange={(event) => setStatusMessage(event.target.value)}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Highlight copy</span>
              <textarea
                value={activeHighlight}
                onChange={(event) => setActiveHighlight(event.target.value)}
                className="min-h-28 rounded-3xl border bg-input/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </label>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Rendered inside a card so it matches the workspace context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatedReceiptLoader
                progress={progress}
                statusMessage={statusMessage}
                activeHighlight={activeHighlight}
                queueItems={queueItems}
                focusedUploadId="focused-upload"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function buildPreviewQueueItems(
  stage: "preparing" | "uploading" | "extracting" | "saving"
): UploadQueueItem[] {
  const baseFile = new File([""], "march-batch-001.jpg", { type: "image/jpeg" })

  return [
    {
      id: "focused-upload",
      file: baseFile,
      fileName: "march-batch-001.jpg",
      fileSize: 1_820_000,
      status: stage,
      progress:
        stage === "preparing"
          ? 12
          : stage === "uploading"
            ? 34
            : stage === "extracting"
              ? 67
              : 91,
      streamedText: "",
      optimized: false,
      errorMessage: "",
      storedReceipt: null,
    },
    {
      id: "queued-1",
      file: new File([""], "jollibee-lunch.jpg", { type: "image/jpeg" }),
      fileName: "jollibee-lunch.jpg",
      fileSize: 980_000,
      status: "queued",
      progress: 0,
      streamedText: "",
      optimized: false,
      errorMessage: "",
      storedReceipt: null,
    },
    {
      id: "queued-2",
      file: new File([""], "office-supplies.pdf", { type: "application/pdf" }),
      fileName: "office-supplies.pdf",
      fileSize: 2_140_000,
      status: "uploading",
      progress: 28,
      streamedText: "",
      optimized: false,
      errorMessage: "",
      storedReceipt: null,
    },
    {
      id: "queued-3",
      file: new File([""], "fuel-receipt.png", { type: "image/png" }),
      fileName: "fuel-receipt.png",
      fileSize: 640_000,
      status: "done",
      progress: 100,
      streamedText: "",
      optimized: false,
      errorMessage: "",
      storedReceipt: null,
    },
    {
      id: "queued-4",
      file: new File([""], "grab-ride.jpg", { type: "image/jpeg" }),
      fileName: "grab-ride.jpg",
      fileSize: 710_000,
      status: "saving",
      progress: 88,
      streamedText: "",
      optimized: false,
      errorMessage: "",
      storedReceipt: null,
    },
  ]
}
