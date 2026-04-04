import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { guestUsageMeterMonthly } from "@/lib/db/schema"

function toMonthKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function getGuestLimit() {
  return Number(process.env.GUEST_FREE_RECEIPT_LIMIT) || 5
}

export async function getGuestMonthlyUsage(guestId: string) {
  const monthKey = toMonthKey(new Date())
  const usage = await db.query.guestUsageMeterMonthly.findFirst({
    where: and(
      eq(guestUsageMeterMonthly.guestId, guestId),
      eq(guestUsageMeterMonthly.monthKey, monthKey)
    ),
    columns: {
      processedCount: true,
    },
  })

  const used = usage?.processedCount ?? 0
  const limit = getGuestLimit()

  return {
    guestId,
    monthKey,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
  }
}

export async function incrementGuestMonthlyUsage(guestId: string) {
  const monthKey = toMonthKey(new Date())

  await db
    .insert(guestUsageMeterMonthly)
    .values({
      guestId,
      monthKey,
      processedCount: 1,
    })
    .onConflictDoUpdate({
      target: [guestUsageMeterMonthly.guestId, guestUsageMeterMonthly.monthKey],
      set: {
        processedCount: sql`${guestUsageMeterMonthly.processedCount} + 1`,
        updatedAt: new Date(),
      },
    })

  return getGuestMonthlyUsage(guestId)
}
