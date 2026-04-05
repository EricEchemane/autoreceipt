import { NextResponse } from "next/server"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import {
  forceMonthlyLimitReached,
  getMonthlyUsage,
  resetMonthlyUsage,
} from "@/lib/usage"

export async function GET() {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const usage = await getMonthlyUsage(organization.id)
    return NextResponse.json({ usage })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not read monthly usage.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Simulation endpoints are disabled in production." },
      { status: 403 }
    )
  }

  const payload = (await request.json().catch(() => null)) as
    | { action?: "simulate_limit" | "reset_usage" }
    | null

  if (payload?.action === "simulate_limit") {
    try {
      const usage = await forceMonthlyLimitReached({
        organizationId: organization.id,
        userId: session.user.id,
      })
      return NextResponse.json({ usage })
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not simulate monthly limit.",
        },
        { status: 500 }
      )
    }
  }

  if (payload?.action === "reset_usage") {
    try {
      const usage = await resetMonthlyUsage({
        organizationId: organization.id,
        userId: session.user.id,
      })
      return NextResponse.json({ usage })
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not reset monthly usage.",
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    { error: "Invalid action. Use simulate_limit or reset_usage." },
    { status: 400 }
  )
}
