import { z } from "zod"

export const receiptItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  price: z.number(),
  category: z.string(),
  taxableSales: z.number(),
})

export const receiptSchema = z.object({
  merchantName: z.string(),
  tinNumber: z.string(),
  officialReceiptNumber: z.string(),
  totalAmountDue: z.number(),
  taxableSales: z.number(),
  vatAmount: z.number(),
  confidence: z.number().min(0).max(100),
  purchaseDate: z.string(),
  notes: z.string(),
  items: z.array(receiptItemSchema),
})

export const storedReceiptSchema = receiptSchema.extend({
  id: z.string(),
  sourceFileName: z.string(),
  sourceFileUrl: z.string(),
  sourceMimeType: z.string(),
  createdAt: z.string(),
  reviewStatus: z.enum(["new", "reviewed", "posted", "archived"]).default("new"),
})

export type ReceiptData = z.infer<typeof receiptSchema>
export type ReceiptItem = z.infer<typeof receiptItemSchema>
export type StoredReceipt = z.infer<typeof storedReceiptSchema>
