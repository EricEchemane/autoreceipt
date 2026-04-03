import type { Metadata } from "next"

import { ReceiptPrototype } from "@/components/receipt-prototype"

export const metadata: Metadata = {
  title: "AutoReceipt",
  description:
    "Scan and extract receipt details with a streamlined upload and review flow.",
}

export default function Page() {
  return <ReceiptPrototype />
}
