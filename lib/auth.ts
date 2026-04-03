import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { db } from "@/lib/db"
import { accounts, sessions, users, verifications } from "@/lib/db/schema"

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const auth = betterAuth({
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
})
