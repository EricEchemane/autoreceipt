import { NextResponse } from "next/server"
import { z } from "zod"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { isBusinessPlan, syncBillingStatusForOrganization } from "@/lib/billing"
import { cancelOrganizationInvite } from "@/lib/organization"

const paramsSchema = z.object({
  inviteId: z.coerce.number().int().positive(),
})

function canManageInvites(role: string | null | undefined) {
  return role === "owner" || role === "admin"
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> }
) {
  const { session, organization, membership } = await getServerOrganizationSession()

  if (!session?.user || !organization || !membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const billing = await syncBillingStatusForOrganization(organization.id)

  if (!isBusinessPlan(billing?.plan)) {
    return NextResponse.json(
      { error: "Membership invites are only available on the Business plan." },
      { status: 403 }
    )
  }

  if (!canManageInvites(membership.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can cancel invites." },
      { status: 403 }
    )
  }

  const params = await context.params
  const parsed = paramsSchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite id." }, { status: 400 })
  }

  const invite = await cancelOrganizationInvite({
    organizationId: organization.id,
    inviteId: parsed.data.inviteId,
  })

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 })
  }

  return NextResponse.json({ invite })
}
