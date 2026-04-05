import { getServerSession } from "@/lib/auth-session"
import { getCurrentOrganizationForUser } from "@/lib/organization"

export async function getServerOrganizationSession() {
  const session = await getServerSession()

  if (!session?.user) {
    return {
      session: null,
      organization: null,
      membership: null,
    }
  }

  const { organization, membership } = await getCurrentOrganizationForUser({
    id: session.user.id,
    name: session.user.name,
  })

  return {
    session,
    organization,
    membership,
  }
}
