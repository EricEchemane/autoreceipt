import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { getOrCreateBillingCustomer, upsertBillingCustomer } from "@/lib/billing"
import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { createRecurringPlan, deactivateRecurringPlan } from "@/lib/xendit"

function getPlanConfig(plan: "pro" | "business") {
  const envPrefix = plan === "business" ? "XENDIT_BUSINESS" : "XENDIT_PRO"
  const fallbackToLegacy = plan === "pro"

  const amount = Number(
    process.env[`${envPrefix}_PLAN_AMOUNT`] ??
      (fallbackToLegacy ? process.env.XENDIT_PLAN_AMOUNT : undefined)
  )
  const interval =
    process.env[`${envPrefix}_PLAN_INTERVAL`] ??
    (fallbackToLegacy ? process.env.XENDIT_PLAN_INTERVAL : undefined) ??
    "MONTH"
  const intervalCount = Number(
    process.env[`${envPrefix}_PLAN_INTERVAL_COUNT`] ??
      (fallbackToLegacy ? process.env.XENDIT_PLAN_INTERVAL_COUNT : undefined) ??
      "1"
  )
  const totalRecurrenceValue =
    process.env[`${envPrefix}_PLAN_TOTAL_RECURRENCE`] ??
    (fallbackToLegacy ? process.env.XENDIT_PLAN_TOTAL_RECURRENCE : undefined)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${envPrefix}_PLAN_AMOUNT must be a positive number.`)
  }

  if (!["DAY", "WEEK", "MONTH"].includes(interval)) {
    throw new Error("XENDIT_PLAN_INTERVAL must be DAY, WEEK, or MONTH.")
  }

  if (!Number.isInteger(intervalCount) || intervalCount <= 0) {
    throw new Error("XENDIT_PLAN_INTERVAL_COUNT must be a positive integer.")
  }

  return {
    amount,
    currency:
      process.env[`${envPrefix}_PLAN_CURRENCY`] ??
      (fallbackToLegacy ? process.env.XENDIT_PLAN_CURRENCY : undefined) ??
      "PHP",
    interval: interval as "DAY" | "WEEK" | "MONTH",
    intervalCount,
    planCode:
      process.env[`${envPrefix}_PLAN_CODE`] ??
      (fallbackToLegacy ? process.env.XENDIT_PLAN_CODE : undefined) ??
      plan,
    planName:
      process.env[`${envPrefix}_PLAN_NAME`] ??
      (fallbackToLegacy ? process.env.XENDIT_PLAN_NAME : undefined) ??
      (plan === "business" ? "Business" : "Pro"),
    totalRecurrence: totalRecurrenceValue
      ? Number(totalRecurrenceValue)
      : null,
  }
}

function normalizePlan(plan: string | null | undefined) {
  const lower = (plan ?? "").toLowerCase()

  if (lower.includes("business")) {
    return "business" as const
  }

  if (lower.includes("pro")) {
    return "pro" as const
  }

  return "free" as const
}

export async function POST(request: Request) {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { plan?: "pro" | "business" }
      | null
    const requestedPlan = payload?.plan === "business" ? "business" : "pro"

    const existingBilling = await db.query.billingCustomers.findFirst({
      where: eq(billingCustomers.organizationId, organization.id),
    })
    const currentPlan = normalizePlan(existingBilling?.plan)

    if (
      existingBilling &&
      ["pending", "requires_action", "trialing"].includes(existingBilling.status)
    ) {
      return NextResponse.json(
        {
          error:
            "You already have a subscription in progress. Cancel it before starting a new one.",
        },
        { status: 409 }
      )
    }

    if (existingBilling?.status === "active" && currentPlan === requestedPlan) {
      return NextResponse.json(
        {
          error: `You're already on the ${requestedPlan} plan.`,
        },
        { status: 409 }
      )
    }

    if (
      existingBilling?.status === "active" &&
      currentPlan !== "free" &&
      currentPlan !== requestedPlan &&
      existingBilling.providerSubscriptionId
    ) {
      await deactivateRecurringPlan(existingBilling.providerSubscriptionId)
    }

    const plan = getPlanConfig(requestedPlan)
    const customerId = await getOrCreateBillingCustomer({
      organizationId: organization.id,
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
        organizationId: organization.id,
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

    await upsertBillingCustomer(organization.id, {
      userId: session.user.id,
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
