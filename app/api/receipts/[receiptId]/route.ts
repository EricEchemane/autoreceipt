import { z } from "zod"

import { getServerOrganizationSession } from "@/lib/auth-organization"
import { updateReceipt } from "@/lib/receipt-store"

export const runtime = "nodejs"

const updateReceiptSchema = z.object({
  merchantName: z.string().trim(),
  tinNumber: z.string().trim(),
  officialReceiptNumber: z.string().trim(),
  purchaseDate: z.string().trim(),
  totalAmountDue: z.number().finite().nonnegative(),
  taxableSales: z.number().finite().nonnegative(),
  vatAmount: z.number().finite().nonnegative(),
  notes: z.string(),
  reviewStatus: z.enum(["new", "reviewed", "posted", "archived"]),
  category: z.string().trim().min(1),
})

export async function PUT(
  request: Request,
  context: { params: Promise<{ receiptId: string }> }
) {
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

  const parsed = updateReceiptSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json({ error: "Please provide valid receipt fields." }, { status: 400 })
  }

  try {
    const { receiptId } = await context.params
    const receipt = await updateReceipt({
      ...parsed.data,
      id: receiptId,
      organizationId: organization.id,
      userId: session.user.id,
    })

    return Response.json({ receipt })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update this receipt.",
      },
      { status: 400 }
    )
  }
}
