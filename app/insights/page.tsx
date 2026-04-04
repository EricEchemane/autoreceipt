import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ReceiptsInsights } from "@/components/receipts-insights"
import { getServerSession } from "@/lib/auth-session"

export const metadata: Metadata = {
  title: "Insights",
  description:
    "See receipt trends and expense insights generated from your uploaded records.",
}

export default async function InsightsPage() {
  const session = await getServerSession()

  if (!session?.user) {
    redirect("/sign-in")
  }

  return <ReceiptsInsights />
}
