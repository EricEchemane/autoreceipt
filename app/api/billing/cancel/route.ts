import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { upsertBillingCustomer } from "@/lib/billing"
import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { deactivateRecurringPlan } from "@/lib/xendit"

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
      { error: "No active Xendit subscription found for this user." },
      { status: 404 }
    )
  }

  try {
    const subscription = await deactivateRecurringPlan(
      billing.providerSubscriptionId
    )
    const hasRemainingAccess =
      billing.currentPeriodEnd instanceof Date &&
      billing.currentPeriodEnd.getTime() > Date.now()

    await upsertBillingCustomer(organization.id, {
      userId: billing.userId,
      provider: "xendit",
      providerCustomerId: billing.providerCustomerId,
      providerSubscriptionId: subscription.id,
      providerPlanId: billing.providerPlanId,
      plan: billing.plan,
      status: hasRemainingAccess ? "active" : subscription.status.toLowerCase(),
      currentPeriodEnd: billing.currentPeriodEnd,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Subscription could not be cancelled.",
      },
      { status: 500 }
    )
  }
}
