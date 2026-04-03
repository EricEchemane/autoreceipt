import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/lib/db/schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.")
}

const globalForDb = globalThis as unknown as {
  sql: ReturnType<typeof postgres> | undefined
}

const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL, {
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    prepare: false,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql
}

export const db = drizzle(sql, { schema })
export { schema }
