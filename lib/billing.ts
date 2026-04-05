import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { createCustomer, getRecurringPlan } from "@/lib/xendit"

type CustomerSeed = {
  organizationId: string
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
    where: eq(billingCustomers.organizationId, seed.organizationId),
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
      organizationId: seed.organizationId,
    },
  })

  await upsertBillingCustomer(seed.organizationId, {
    userId: seed.userId,
    provider: "xendit",
    providerCustomerId: customer.id,
    status: existing?.status ?? "inactive",
    plan: existing?.plan ?? "free",
  })

  return customer.id
}

type BillingUpdate = {
  userId?: string
  provider?: string
  providerCustomerId?: string | null
  providerSubscriptionId?: string | null
  providerPlanId?: string | null
  plan?: string
  status?: string
  currentPeriodEnd?: Date | null
}

export function isBusinessPlan(plan: string | null | undefined) {
  return (plan ?? "").toLowerCase().includes("business")
}

export async function upsertBillingCustomer(
  organizationId: string,
  update: BillingUpdate
) {
  const existing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.organizationId, organizationId),
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
    if (!update.userId) {
      throw new Error("Billing record creation requires a userId.")
    }

    await db.insert(billingCustomers).values({
      organizationId,
      userId: update.userId,
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

export async function syncBillingStatusForOrganization(organizationId: string) {
  const billing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.organizationId, organizationId),
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
      await upsertBillingCustomer(organizationId, {
        userId: billing.userId,
        provider: "xendit",
        providerCustomerId: plan.customer_id,
        providerSubscriptionId: plan.id,
        providerPlanId: billing.providerPlanId,
        plan: billing.plan,
        status: nextStatus,
      })

      return db.query.billingCustomers.findFirst({
        where: eq(billingCustomers.organizationId, organizationId),
      })
    }
  } catch {
    return billing
  }

  return billing
}
