import crypto from "node:crypto"
import path from "node:path"

import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { receipts } from "@/lib/db/schema"
import { storeReceiptSourceFile } from "@/lib/receipt-file-storage"
import type { ReceiptData, StoredReceipt } from "@/lib/receipt-schema"

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function buildReceiptFingerprint(receipt: ReceiptData | StoredReceipt) {
  const merchant = normalizeText(receipt.merchantName)
  const officialReceiptNumber = normalizeText(receipt.officialReceiptNumber)
  const purchaseDate = normalizeText(receipt.purchaseDate)

  if (!merchant || !officialReceiptNumber || !purchaseDate) {
    return null
  }

  return [merchant, officialReceiptNumber, purchaseDate, receipt.totalAmountDue].join(
    ":"
  )
}

function safeExtensionFromName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase()

  if (!extension) {
    return ".bin"
  }

  return extension.replace(/[^a-z0-9.]/g, "") || ".bin"
}

function mapDbReceiptToStoredReceipt(
  row: typeof receipts.$inferSelect
): StoredReceipt {
  return {
    id: row.id,
    sourceFileName: row.sourceFileName,
    sourceFileUrl: row.sourceFileUrl,
    sourceMimeType: row.sourceMimeType,
    sourceFileHash: row.sourceFileHash,
    createdAt: row.createdAt.toISOString(),
    reviewStatus:
      row.reviewStatus === "reviewed" ||
      row.reviewStatus === "posted" ||
      row.reviewStatus === "archived"
        ? row.reviewStatus
        : "new",
    merchantName: row.merchantName,
    tinNumber: row.tinNumber,
    officialReceiptNumber: row.officialReceiptNumber,
    totalAmountDue: row.totalAmountDue,
    taxableSales: row.taxableSales,
    vatAmount: row.vatAmount,
    confidence: row.confidence,
    purchaseDate: row.purchaseDate,
    notes: row.notes,
    items: row.items ?? [],
  }
}

export async function listReceipts(userId: string) {
  const rows = await db.query.receipts.findMany({
    where: eq(receipts.userId, userId),
    orderBy: [desc(receipts.createdAt)],
  })

  return rows.map(mapDbReceiptToStoredReceipt)
}

export async function persistReceipt(params: {
  userId: string
  sourceFileName: string
  sourceMimeType: string
  fileBuffer: Buffer
  extractedReceipt: ReceiptData
}) {
  const sourceFileHash = crypto
    .createHash("sha256")
    .update(params.fileBuffer)
    .digest("hex")
  const nextFingerprint = buildReceiptFingerprint(params.extractedReceipt)

  const duplicateByHash = await db.query.receipts.findFirst({
    where: and(
      eq(receipts.userId, params.userId),
      eq(receipts.sourceFileHash, sourceFileHash)
    ),
  })

  if (duplicateByHash) {
    return {
      receipt: mapDbReceiptToStoredReceipt(duplicateByHash),
      duplicate: true as const,
    }
  }

  if (nextFingerprint) {
    const duplicateByFingerprint = await db.query.receipts.findFirst({
      where: and(
        eq(receipts.userId, params.userId),
        eq(receipts.receiptFingerprint, nextFingerprint)
      ),
    })

    if (duplicateByFingerprint) {
      return {
        receipt: mapDbReceiptToStoredReceipt(duplicateByFingerprint),
        duplicate: true as const,
      }
    }
  }

  const id = crypto.randomUUID()
  const extension = safeExtensionFromName(params.sourceFileName)
  const storedFileName = `${id}${extension}`
  const { sourceFileUrl } = await storeReceiptSourceFile({
    fileBuffer: params.fileBuffer,
    storedFileName,
    sourceMimeType: params.sourceMimeType,
  })

  const [inserted] = await db
    .insert(receipts)
    .values({
      id,
      userId: params.userId,
      sourceFileName: params.sourceFileName,
      sourceFileUrl,
      sourceMimeType: params.sourceMimeType,
      sourceFileHash,
      receiptFingerprint: nextFingerprint,
      merchantName: params.extractedReceipt.merchantName,
      tinNumber: params.extractedReceipt.tinNumber,
      officialReceiptNumber: params.extractedReceipt.officialReceiptNumber,
      totalAmountDue: params.extractedReceipt.totalAmountDue,
      taxableSales: params.extractedReceipt.taxableSales,
      vatAmount: params.extractedReceipt.vatAmount,
      confidence: params.extractedReceipt.confidence,
      purchaseDate: params.extractedReceipt.purchaseDate,
      notes: params.extractedReceipt.notes,
      items: params.extractedReceipt.items,
      reviewStatus: "new",
    })
    .returning()

  return {
    receipt: mapDbReceiptToStoredReceipt(inserted),
    duplicate: false as const,
  }
}

export async function bulkUpdateReceipts(params: {
  userId: string
  ids: string[]
  reviewStatus?: StoredReceipt["reviewStatus"]
  category?: string
}) {
  const idSet = new Set(params.ids)

  if (idSet.size === 0) {
    return []
  }

  const rows = await db.query.receipts.findMany({
    where: and(
      eq(receipts.userId, params.userId),
      inArray(receipts.id, Array.from(idSet))
    ),
  })

  const nextCategory = params.category?.trim()
  const updated: StoredReceipt[] = []

  for (const row of rows) {
    const nextItems = nextCategory
      ? (row.items ?? []).map((item) => ({ ...item, category: nextCategory }))
      : (row.items ?? [])
    const nextReviewStatus = params.reviewStatus ?? row.reviewStatus

    const [nextRow] = await db
      .update(receipts)
      .set({
        reviewStatus: nextReviewStatus,
        items: nextItems,
        updatedAt: new Date(),
      })
      .where(and(eq(receipts.userId, params.userId), eq(receipts.id, row.id)))
      .returning()

    if (nextRow) {
      updated.push(mapDbReceiptToStoredReceipt(nextRow))
    }
  }

  return updated
}
