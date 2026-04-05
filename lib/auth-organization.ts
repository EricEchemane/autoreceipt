import { cookies } from "next/headers"

import { getServerSession } from "@/lib/auth-session"
import {
  getCurrentOrganizationForUser,
  userHasOrganizationMembership,
} from "@/lib/organization"

export const ACTIVE_ORGANIZATION_COOKIE = "ar_active_org"

export async function getServerOrganizationSession() {
  const session = await getServerSession()

  if (!session?.user) {
    return {
      session: null,
      organization: null,
      membership: null,
    }
  }

  const cookieStore = await cookies()
  const preferredOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value

  const isAllowedPreferredOrganization = preferredOrganizationId
    ? await userHasOrganizationMembership({
        userId: session.user.id,
        organizationId: preferredOrganizationId,
      })
    : false

  const { organization, membership } = await getCurrentOrganizationForUser({
    id: session.user.id,
    name: session.user.name,
  }, isAllowedPreferredOrganization ? preferredOrganizationId : null)

  return {
    session,
    organization,
    membership,
  }
}
