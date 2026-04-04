import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const dataDirectory = path.join(process.cwd(), ".data")
const usageStorePath = path.join(dataDirectory, "guest-usage.json")

type GuestUsageStore = Record<string, number>

function toMonthKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function buildUsageKey(guestId: string, monthKey: string) {
  return `${guestId}:${monthKey}`
}

async function readUsageStore() {
  await mkdir(dataDirectory, { recursive: true })

  try {
    const raw = await readFile(usageStorePath, "utf8")
    return JSON.parse(raw) as GuestUsageStore
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {}
    }

    throw error
  }
}

async function writeUsageStore(store: GuestUsageStore) {
  await mkdir(dataDirectory, { recursive: true })
  await writeFile(usageStorePath, JSON.stringify(store, null, 2), "utf8")
}

export async function getGuestMonthlyUsage(guestId: string) {
  const monthKey = toMonthKey(new Date())
  const key = buildUsageKey(guestId, monthKey)
  const store = await readUsageStore()
  const used = store[key] ?? 0
  const limit = Number(process.env.GUEST_FREE_RECEIPT_LIMIT) || 5

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
  const key = buildUsageKey(guestId, monthKey)
  const store = await readUsageStore()
  const next = (store[key] ?? 0) + 1

  store[key] = next
  await writeUsageStore(store)

  const limit = Number(process.env.GUEST_FREE_RECEIPT_LIMIT) || 5

  return {
    guestId,
    monthKey,
    used: next,
    limit,
    remaining: Math.max(limit - next, 0),
  }
}
