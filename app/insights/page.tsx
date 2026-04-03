import type { Metadata } from "next"

import { ReceiptsInsights } from "@/components/receipts-insights"

export const metadata: Metadata = {
  title: "Insights",
  description:
    "See receipt trends and expense insights generated from your uploaded records.",
}

export default function InsightsPage() {
  return <ReceiptsInsights />
}
