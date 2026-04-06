import crypto from "node:crypto"
import path from "node:path"

import { and, desc, eq, inArray, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import { receiptActivities, receipts } from "@/lib/db/schema"
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

async function appendReceiptActivity(params: {
  organizationId: string
  receiptId: string
  actorUserId: string
  action: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(receiptActivities).values({
    organizationId: params.organizationId,
    receiptId: params.receiptId,
    actorUserId: params.actorUserId,
    action: params.action,
    metadata: params.metadata ?? {},
  })
}

export async function listReceipts(organizationId: string) {
  const rows = await db.query.receipts.findMany({
    where: eq(receipts.organizationId, organizationId),
    orderBy: [desc(receipts.createdAt)],
  })

  return rows.map(mapDbReceiptToStoredReceipt)
}

export async function persistReceipt(params: {
  organizationId: string
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
      eq(receipts.organizationId, params.organizationId),
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
        eq(receipts.organizationId, params.organizationId),
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
      organizationId: params.organizationId,
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

  await appendReceiptActivity({
    organizationId: params.organizationId,
    receiptId: inserted.id,
    actorUserId: params.userId,
    action: "receipt.created",
    metadata: {
      sourceFileName: params.sourceFileName,
      duplicate: false,
    },
  })

  return {
    receipt: mapDbReceiptToStoredReceipt(inserted),
    duplicate: false as const,
  }
}

export async function bulkUpdateReceipts(params: {
  organizationId: string
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
      eq(receipts.organizationId, params.organizationId),
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
        reviewedByUserId:
          nextReviewStatus === "reviewed" ? params.userId : row.reviewedByUserId,
        postedByUserId:
          nextReviewStatus === "posted" ? params.userId : row.postedByUserId,
        items: nextItems,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receipts.organizationId, params.organizationId),
          eq(receipts.id, row.id)
        )
      )
      .returning()

    if (nextRow) {
      await appendReceiptActivity({
        organizationId: params.organizationId,
        receiptId: nextRow.id,
        actorUserId: params.userId,
        action: "receipt.updated",
        metadata: {
          reviewStatus: nextReviewStatus,
          category: nextCategory ?? null,
        },
      })
      updated.push(mapDbReceiptToStoredReceipt(nextRow))
    }
  }

  return updated
}

export async function updateReceipt(params: {
  organizationId: string
  userId: string
  id: string
  merchantName: string
  tinNumber: string
  officialReceiptNumber: string
  purchaseDate: string
  totalAmountDue: number
  taxableSales: number
  vatAmount: number
  notes: string
  reviewStatus: StoredReceipt["reviewStatus"]
  category: string
}) {
  const row = await db.query.receipts.findFirst({
    where: and(
      eq(receipts.organizationId, params.organizationId),
      eq(receipts.id, params.id)
    ),
  })

  if (!row) {
    throw new Error("Receipt not found.")
  }

  const nextItems = (row.items ?? []).map((item) => ({
    ...item,
    category: params.category,
  }))

  const nextFingerprint = buildReceiptFingerprint({
    ...mapDbReceiptToStoredReceipt(row),
    merchantName: params.merchantName,
    officialReceiptNumber: params.officialReceiptNumber,
    purchaseDate: params.purchaseDate,
    totalAmountDue: params.totalAmountDue,
  })

  if (nextFingerprint) {
    const duplicateReceipt = await db.query.receipts.findFirst({
      where: and(
        eq(receipts.organizationId, params.organizationId),
        eq(receipts.receiptFingerprint, nextFingerprint),
        ne(receipts.id, params.id)
      ),
    })

    if (duplicateReceipt) {
      throw new Error(
        "Another saved receipt already matches this merchant, receipt number, date, and amount."
      )
    }
  }

  const [nextRow] = await db
    .update(receipts)
    .set({
      merchantName: params.merchantName,
      tinNumber: params.tinNumber,
      officialReceiptNumber: params.officialReceiptNumber,
      purchaseDate: params.purchaseDate,
      totalAmountDue: params.totalAmountDue,
      taxableSales: params.taxableSales,
      vatAmount: params.vatAmount,
      notes: params.notes,
      items: nextItems,
      reviewStatus: params.reviewStatus,
      reviewedByUserId:
        params.reviewStatus === "reviewed" ? params.userId : row.reviewedByUserId,
      postedByUserId:
        params.reviewStatus === "posted" ? params.userId : row.postedByUserId,
      receiptFingerprint: nextFingerprint,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(receipts.organizationId, params.organizationId),
        eq(receipts.id, params.id)
      )
    )
    .returning()

  if (!nextRow) {
    throw new Error("Could not update receipt.")
  }

  await appendReceiptActivity({
    organizationId: params.organizationId,
    receiptId: nextRow.id,
    actorUserId: params.userId,
    action: "receipt.updated",
    metadata: {
      editedFields: [
        "merchantName",
        "tinNumber",
        "officialReceiptNumber",
        "purchaseDate",
        "totalAmountDue",
        "taxableSales",
        "vatAmount",
        "notes",
        "reviewStatus",
        "category",
      ],
    },
  })

  return mapDbReceiptToStoredReceipt(nextRow)
}
