import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getOrCreateBillingCustomer, upsertBillingCustomer } from "@/lib/billing"
import { getServerSession } from "@/lib/auth-session"
import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { createRecurringPlan } from "@/lib/xendit"

function getPlanConfig() {
  const amount = Number(process.env.XENDIT_PLAN_AMOUNT)
  const interval = process.env.XENDIT_PLAN_INTERVAL ?? "MONTH"
  const intervalCount = Number(process.env.XENDIT_PLAN_INTERVAL_COUNT ?? "1")
  const totalRecurrenceValue = process.env.XENDIT_PLAN_TOTAL_RECURRENCE

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("XENDIT_PLAN_AMOUNT must be a positive number.")
  }

  if (!["DAY", "WEEK", "MONTH"].includes(interval)) {
    throw new Error("XENDIT_PLAN_INTERVAL must be DAY, WEEK, or MONTH.")
  }

  if (!Number.isInteger(intervalCount) || intervalCount <= 0) {
    throw new Error("XENDIT_PLAN_INTERVAL_COUNT must be a positive integer.")
  }

  return {
    amount,
    currency: process.env.XENDIT_PLAN_CURRENCY ?? "PHP",
    interval: interval as "DAY" | "WEEK" | "MONTH",
    intervalCount,
    planCode: process.env.XENDIT_PLAN_CODE ?? "pro",
    planName: process.env.XENDIT_PLAN_NAME ?? "Pro",
    totalRecurrence: totalRecurrenceValue
      ? Number(totalRecurrenceValue)
      : null,
  }
}

export async function POST() {
  const session = await getServerSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const existingBilling = await db.query.billingCustomers.findFirst({
      where: eq(billingCustomers.userId, session.user.id),
    })

    if (
      existingBilling &&
      ["active", "pending", "requires_action", "trialing"].includes(
        existingBilling.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You already have a subscription in progress. Cancel it before starting a new one.",
        },
        { status: 409 }
      )
    }

    const plan = getPlanConfig()
    const customerId = await getOrCreateBillingCustomer({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    })

    const url = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
    const referenceId = `sub:${session.user.id}:${crypto.randomUUID()}`

    const subscription = await createRecurringPlan({
      reference_id: referenceId,
      customer_id: customerId,
      recurring_action: "PAYMENT",
      currency: plan.currency,
      amount: plan.amount,
      schedule: {
        reference_id: `sched:${session.user.id}:${crypto.randomUUID()}`,
        interval: plan.interval,
        interval_count: plan.intervalCount,
        total_recurrence: plan.totalRecurrence,
        anchor_date: new Date().toISOString(),
        retry_interval: "DAY",
        retry_interval_count: 1,
        total_retry: 2,
      },
      immediate_action_type: "FULL_AMOUNT",
      failed_cycle_action: "STOP",
      success_return_url: `${url}/billing?status=success`,
      failure_return_url: `${url}/billing?status=cancelled`,
      description: `${plan.planName} subscription for AutoReceipt`,
      metadata: {
        userId: session.user.id,
        planCode: plan.planCode,
      },
      items: [
        {
          type: "DIGITAL_SERVICE",
          name: plan.planName,
          net_unit_amount: plan.amount,
          quantity: 1,
          description: "AutoReceipt subscription",
        },
      ],
    })

    await upsertBillingCustomer(session.user.id, {
      provider: "xendit",
      providerCustomerId: customerId,
      providerSubscriptionId: subscription.id,
      providerPlanId: plan.planCode,
      plan: plan.planName.toLowerCase(),
      status: subscription.status.toLowerCase(),
      currentPeriodEnd: null,
    })

    const authUrl = subscription.actions?.find(
      (action) => action.action === "AUTH"
    )?.url

    if (!authUrl) {
      return NextResponse.json(
        {
          error:
            "Xendit did not return a hosted authorization URL for this subscription.",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Xendit checkout could not start.",
      },
      { status: 500 }
    )
  }
}
