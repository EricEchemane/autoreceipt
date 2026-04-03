import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { createCustomer, getRecurringPlan } from "@/lib/xendit"

type CustomerSeed = {
  userId: string
  email: string
  name: string
}

function splitName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ")

  if (!normalized) {
    return {
      givenNames: "AutoReceipt",
      surname: "Customer",
    }
  }

  const [givenNames, ...surnameParts] = normalized.split(" ")

  return {
    givenNames,
    surname: surnameParts.join(" ") || undefined,
  }
}

export async function getOrCreateBillingCustomer(seed: CustomerSeed) {
  const existing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, seed.userId),
  })

  if (existing?.providerCustomerId) {
    return existing.providerCustomerId
  }

  const { givenNames, surname } = splitName(seed.name)
  const customer = await createCustomer({
    reference_id: `user:${seed.userId}`,
    type: "INDIVIDUAL",
    individual_detail: {
      given_names: givenNames,
      surname,
    },
    email: seed.email,
    metadata: {
      userId: seed.userId,
    },
  })

  await upsertBillingCustomer(seed.userId, {
    provider: "xendit",
    providerCustomerId: customer.id,
    status: existing?.status ?? "inactive",
    plan: existing?.plan ?? "free",
  })

  return customer.id
}

type BillingUpdate = {
  provider?: string
  providerCustomerId?: string | null
  providerSubscriptionId?: string | null
  providerPlanId?: string | null
  plan?: string
  status?: string
  currentPeriodEnd?: Date | null
}

export async function upsertBillingCustomer(
  userId: string,
  update: BillingUpdate
) {
  const existing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, userId),
  })

  if (existing) {
    await db
      .update(billingCustomers)
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where(eq(billingCustomers.id, existing.id))
  } else {
    await db.insert(billingCustomers).values({
      userId,
      provider: update.provider ?? "xendit",
      providerCustomerId: update.providerCustomerId ?? null,
      providerSubscriptionId: update.providerSubscriptionId ?? null,
      providerPlanId: update.providerPlanId ?? null,
      status: update.status ?? "inactive",
      plan: update.plan ?? "free",
      currentPeriodEnd: update.currentPeriodEnd ?? null,
    })
  }
}

function mapXenditPlanStatus(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "active"
    case "PENDING":
      return "pending"
    case "REQUIRES_ACTION":
      return "requires_action"
    case "INACTIVE":
    default:
      return "inactive"
  }
}

export async function syncBillingStatusForUser(userId: string) {
  const billing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, userId),
  })

  if (!billing?.providerSubscriptionId) {
    return billing
  }

  try {
    const plan = await getRecurringPlan(billing.providerSubscriptionId)
    const nextStatus = mapXenditPlanStatus(plan.status)

    if (
      billing.status !== nextStatus ||
      billing.providerCustomerId !== plan.customer_id
    ) {
      await upsertBillingCustomer(userId, {
        provider: "xendit",
        providerCustomerId: plan.customer_id,
        providerSubscriptionId: plan.id,
        providerPlanId: billing.providerPlanId,
        plan: billing.plan,
        status: nextStatus,
      })

      return db.query.billingCustomers.findFirst({
        where: eq(billingCustomers.userId, userId),
      })
    }
  } catch {
    return billing
  }

  return billing
}
