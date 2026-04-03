import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { upsertBillingCustomer } from "@/lib/billing"
import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"

export async function POST(request: Request) {
  const callbackToken = request.headers.get("x-callback-token")
  const webhookSecret = process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN

  if (!callbackToken || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Xendit callback token or webhook verification token." },
      { status: 400 }
    )
  }

  if (callbackToken !== webhookSecret) {
    return NextResponse.json(
      { error: "Xendit webhook verification failed." },
      { status: 401 }
    )
  }

  const payload = (await request.json()) as {
    event?: string
    data?: Record<string, unknown>
  }

  const event = payload.event
  const data = payload.data ?? {}
  const providerSubscriptionId =
    typeof data.id === "string"
      ? data.id
      : typeof data.plan_id === "string"
        ? data.plan_id
        : null
  const providerCustomerId =
    typeof data.customer_id === "string" ? data.customer_id : null

  if (!event || (!providerSubscriptionId && !providerCustomerId)) {
    return NextResponse.json({ received: true })
  }

  const billing = providerSubscriptionId
    ? await db.query.billingCustomers.findFirst({
        where: eq(
          billingCustomers.providerSubscriptionId,
          providerSubscriptionId
        ),
      })
    : await db.query.billingCustomers.findFirst({
        where: eq(billingCustomers.providerCustomerId, providerCustomerId!),
      })

  if (!billing) {
    return NextResponse.json({ received: true })
  }

  const status = mapXenditStatus(event, billing.currentPeriodEnd)

  await upsertBillingCustomer(billing.userId, {
    provider: "xendit",
    providerCustomerId: providerCustomerId ?? billing.providerCustomerId,
    providerSubscriptionId: providerSubscriptionId ?? billing.providerSubscriptionId,
    providerPlanId:
      typeof data.reference_id === "string"
        ? data.reference_id
        : billing.providerPlanId,
    plan: billing.plan,
    status,
    currentPeriodEnd: extractDate(
      data.scheduled_timestamp,
      data.charge_date
    ) ?? billing.currentPeriodEnd,
  })

  return NextResponse.json({ received: true })
}

function mapXenditStatus(event: string, currentPeriodEnd: Date | null) {
  const hasRemainingAccess =
    currentPeriodEnd instanceof Date && currentPeriodEnd.getTime() > Date.now()

  switch (event) {
    case "recurring.plan.activated":
    case "recurring.cycle.succeeded":
      return "active"
    case "recurring.cycle.created":
      return "pending"
    case "recurring.plan.requires_action":
      return "requires_action"
    case "recurring.plan.inactivated":
      return hasRemainingAccess ? "active" : "inactive"
    case "recurring.cycle.retrying":
      return hasRemainingAccess ? "active" : "past_due"
    case "recurring.cycle.failed":
      return hasRemainingAccess ? "active" : "inactive"
    default:
      return "pending"
  }
}

function extractDate(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue
    }

    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return null
}
