import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { billingCustomers, usageMeterMonthly } from "@/lib/db/schema"

const DEFAULT_FREE_MONTHLY_LIMIT = 25
const DEFAULT_PRO_MONTHLY_LIMIT = 500
const DEFAULT_BUSINESS_MONTHLY_LIMIT = 2000

type PgErrorLike = {
  code?: string
  cause?: {
    code?: string
  }
}

function isMissingUsageTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybePgError = error as PgErrorLike
  return maybePgError.code === "42P01" || maybePgError.cause?.code === "42P01"
}

function toMonthKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function resolveLimitForPlan(plan: string | null | undefined) {
  const lowerPlan = (plan ?? "free").toLowerCase()

  if (lowerPlan.includes("business")) {
    return (
      Number(process.env.BUSINESS_MONTHLY_RECEIPT_LIMIT) ||
      DEFAULT_BUSINESS_MONTHLY_LIMIT
    )
  }

  if (lowerPlan.includes("team") || lowerPlan.includes("pro")) {
    return Number(process.env.PRO_MONTHLY_RECEIPT_LIMIT) || DEFAULT_PRO_MONTHLY_LIMIT
  }

  return Number(process.env.FREE_MONTHLY_RECEIPT_LIMIT) || DEFAULT_FREE_MONTHLY_LIMIT
}

export async function getMonthlyUsage(organizationId: string) {
  const monthKey = toMonthKey(new Date())

  const billing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.organizationId, organizationId),
  })

  let usage: { processedCount: number } | undefined
  let trackingEnabled = true

  try {
    usage = await db.query.usageMeterMonthly.findFirst({
      where: and(
        eq(usageMeterMonthly.organizationId, organizationId),
        eq(usageMeterMonthly.monthKey, monthKey)
      ),
      columns: {
        processedCount: true,
      },
    })
  } catch (error) {
    if (!isMissingUsageTableError(error)) {
      throw error
    }

    trackingEnabled = false
  }

  const limit = resolveLimitForPlan(billing?.plan)
  const used = usage?.processedCount ?? 0

  return {
    monthKey,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    plan: billing?.plan ?? "free",
    status: billing?.status ?? "inactive",
    trackingEnabled,
  }
}

export async function consumeMonthlyReceiptQuota(params: {
  organizationId: string
  userId: string
}) {
  const { organizationId, userId } = params
  const usage = await getMonthlyUsage(organizationId)

  if (!usage.trackingEnabled) {
    return {
      allowed: true as const,
      ...usage,
    }
  }

  if (usage.used >= usage.limit) {
    return {
      allowed: false as const,
      ...usage,
    }
  }

  const nextCount = usage.used + 1

  try {
    await db
      .insert(usageMeterMonthly)
      .values({
        organizationId,
        userId,
        monthKey: usage.monthKey,
        processedCount: 1,
      })
      .onConflictDoUpdate({
        target: [usageMeterMonthly.organizationId, usageMeterMonthly.monthKey],
        set: {
          processedCount: sql`${usageMeterMonthly.processedCount} + 1`,
          updatedAt: new Date(),
        },
      })
  } catch (error) {
    if (!isMissingUsageTableError(error)) {
      throw error
    }

    return {
      allowed: true as const,
      ...usage,
      trackingEnabled: false,
    }
  }

  return {
    allowed: true as const,
    ...usage,
    used: nextCount,
    remaining: Math.max(usage.limit - nextCount, 0),
  }
}

export async function forceMonthlyLimitReached(params: {
  organizationId: string
  userId: string
}) {
  const { organizationId, userId } = params
  const usage = await getMonthlyUsage(organizationId)

  if (!usage.trackingEnabled) {
    throw new Error(
      "Usage tracking table is missing. Run `pnpm db:migrate` and try again."
    )
  }

  await db
    .insert(usageMeterMonthly)
    .values({
      organizationId,
      userId,
      monthKey: usage.monthKey,
      processedCount: usage.limit,
    })
    .onConflictDoUpdate({
      target: [usageMeterMonthly.organizationId, usageMeterMonthly.monthKey],
      set: {
        processedCount: usage.limit,
        updatedAt: new Date(),
      },
    })

  return getMonthlyUsage(organizationId)
}

export async function resetMonthlyUsage(params: {
  organizationId: string
  userId: string
}) {
  const { organizationId, userId } = params
  const usage = await getMonthlyUsage(organizationId)

  if (!usage.trackingEnabled) {
    throw new Error(
      "Usage tracking table is missing. Run `pnpm db:migrate` and try again."
    )
  }

  await db
    .insert(usageMeterMonthly)
    .values({
      organizationId,
      userId,
      monthKey: usage.monthKey,
      processedCount: 0,
    })
    .onConflictDoUpdate({
      target: [usageMeterMonthly.organizationId, usageMeterMonthly.monthKey],
      set: {
        processedCount: 0,
        updatedAt: new Date(),
      },
    })

  return getMonthlyUsage(organizationId)
}
