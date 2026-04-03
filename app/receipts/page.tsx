import type { Metadata } from "next"

import { ReceiptsWorkspace } from "@/components/receipts-workspace"

export const metadata: Metadata = {
  title: "Receipts",
  description:
    "Browse saved receipts, review extracted data, and keep records organized.",
}

export default function ReceiptsPage() {
  return <ReceiptsWorkspace />
}
