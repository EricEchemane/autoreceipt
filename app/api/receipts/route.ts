import { listReceipts } from "@/lib/receipt-store"

export const runtime = "nodejs"

export async function GET() {
  const receipts = await listReceipts()

  return Response.json({ receipts })
}
