import type { Metadata } from "next"

import { AnimatedReceiptLoaderPreview } from "@/components/home/animated-receipt-loader-preview"

export const metadata: Metadata = {
  title: "Loader Preview",
  description: "Inspect and tune the animated receipt loader in isolation.",
}

export default function LoaderPreviewPage() {
  return <AnimatedReceiptLoaderPreview />
}
