import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"

import { getServerSession } from "@/lib/auth-session"
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth-organization"
import { db } from "@/lib/db"
import { billingCustomers } from "@/lib/db/schema"
import { isBusinessPlan } from "@/lib/billing"
import {
  acceptOrganizationInvite,
  getOrganizationInviteByToken,
} from "@/lib/organization"

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1),
})

export async function POST(request: Request) {
  const session = await getServerSession()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const parsed = acceptInviteSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invite token is required." }, { status: 400 })
  }

  try {
    const pendingInvite = await getOrganizationInviteByToken(parsed.data.token)

    if (!pendingInvite) {
      return NextResponse.json(
        { error: "This invite could not be found." },
        { status: 404 }
      )
    }

    const billing = await db.query.billingCustomers.findFirst({
      where: eq(billingCustomers.organizationId, pendingInvite.organizationId),
    })

    if (!isBusinessPlan(billing?.plan)) {
      return NextResponse.json(
        { error: "This workspace is not on the Business plan anymore." },
        { status: 403 }
      )
    }

    const invite = await acceptOrganizationInvite({
      token: parsed.data.token,
      userId: session.user.id,
      userEmail: session.user.email,
    })

    const response = NextResponse.json({ invite })
    response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, pendingInvite.organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    })

    return response
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not accept workspace invite.",
      },
      { status: 400 }
    )
  }
}
