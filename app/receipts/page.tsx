import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ReceiptsWorkspace } from "@/components/receipts-workspace"
import { getServerSession } from "@/lib/auth-session"

export const metadata: Metadata = {
  title: "Receipts",
  description:
    "Browse saved receipts, review extracted data, and keep records organized.",
}

export default async function ReceiptsPage() {
  const session = await getServerSession()

  if (!session?.user) {
    redirect("/sign-in")
  }

  return <ReceiptsWorkspace />
}
