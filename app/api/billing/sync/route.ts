import { NextResponse } from "next/server"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { syncBillingStatusForOrganization } from "@/lib/billing"

export async function POST() {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const billing = await syncBillingStatusForOrganization(organization.id)

  return NextResponse.json({
    status: billing?.status ?? "inactive",
    plan: billing?.plan ?? "free",
  })
}
