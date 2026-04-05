import { z } from "zod"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { bulkUpdateReceipts, listReceipts } from "@/lib/receipt-store"

export const runtime = "nodejs"

const patchSchema = z.object({
  ids: z.array(z.string()).min(1),
  reviewStatus: z
    .enum(["new", "reviewed", "posted", "archived"])
    .optional(),
  category: z.string().trim().min(1).optional(),
})

export async function GET() {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const receipts = await listReceipts(organization.id)

  return Response.json({ receipts })
}

export async function PATCH(request: Request) {
  const { session, organization } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      { error: "Please provide ids plus a valid status or category." },
      { status: 400 }
    )
  }

  if (!parsed.data.reviewStatus && !parsed.data.category) {
    return Response.json(
      { error: "Please provide a status or category update." },
      { status: 400 }
    )
  }

  await bulkUpdateReceipts({
    ...parsed.data,
    organizationId: organization.id,
    userId: session.user.id,
  })
  const receipts = await listReceipts(organization.id)

  return Response.json({ receipts })
}
