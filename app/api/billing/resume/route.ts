import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { getRecurringPlan } from "@/lib/xendit"

export async function POST() {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const billing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.organizationId, organization.id),
  })

  if (!billing?.providerSubscriptionId) {
    return NextResponse.json(
      { error: "No subscription found to continue." },
      { status: 404 }
    )
  }

  try {
    const subscription = await getRecurringPlan(billing.providerSubscriptionId)
    const authUrl = subscription.actions?.find(
      (action) => action.action === "AUTH"
    )?.url

    if (!authUrl) {
      return NextResponse.json(
        {
          error:
            "No pending payment authorization step is available for this subscription.",
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not continue payment setup.",
      },
      { status: 500 }
    )
  }
}
