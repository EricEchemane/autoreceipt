import { NextResponse } from "next/server"
import { z } from "zod"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { isBusinessPlan, syncBillingStatusForOrganization } from "@/lib/billing"
import {
  createOrganizationInvite,
  listOrganizationInvites,
  listOrganizationMembers,
} from "@/lib/organization"

const createInviteSchema = z.object({
  email: z.email(),
  role: z.enum(["owner", "admin", "reviewer", "member"]),
})

function canManageInvites(role: string | null | undefined) {
  return role === "owner" || role === "admin"
}

export async function GET() {
  const { session, organization, membership } = await getServerOrganizationSession()

  if (!session?.user || !organization || !membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const billing = await syncBillingStatusForOrganization(organization.id)
  const businessPlanEnabled = isBusinessPlan(billing?.plan)

  const [members, invites] = await Promise.all([
    listOrganizationMembers(organization.id),
    businessPlanEnabled ? listOrganizationInvites(organization.id) : Promise.resolve([]),
  ])

  return NextResponse.json({
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    membership: {
      role: membership.role,
      status: membership.status,
    },
    permissions: {
      canManageInvites: businessPlanEnabled && canManageInvites(membership.role),
      businessPlanEnabled,
    },
    members,
    invites,
  })
}

export async function POST(request: Request) {
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
      { error: "Only workspace owners and admins can send invites." },
      { status: 403 }
    )
  }

  const payload = await request.json().catch(() => null)
  const parsed = createInviteSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a valid email and role." },
      { status: 400 }
    )
  }

  try {
    const invite = await createOrganizationInvite({
      organizationId: organization.id,
      email: parsed.data.email,
      role: parsed.data.role,
    })

    return NextResponse.json({ invite })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create workspace invite.",
      },
      { status: 400 }
    )
  }
}
