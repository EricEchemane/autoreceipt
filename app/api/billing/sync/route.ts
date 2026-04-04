import { NextResponse } from "next/server"

import { getServerSession } from "@/lib/auth-session"
import { syncBillingStatusForUser } from "@/lib/billing"

export async function POST() {
  const session = await getServerSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const billing = await syncBillingStatusForUser(session.user.id)

  return NextResponse.json({
    status: billing?.status ?? "inactive",
    plan: billing?.plan ?? "free",
  })
}
