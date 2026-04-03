import { mkdir, readFile, writeFile } from "node:fs/promises"
import crypto from "node:crypto"
import path from "node:path"

import type { ReceiptData, StoredReceipt } from "@/lib/receipt-schema"
import { storedReceiptSchema } from "@/lib/receipt-schema"

const dataDirectory = path.join(process.cwd(), ".data")
const receiptStorePath = path.join(dataDirectory, "receipts.json")
const uploadDirectory = path.join(process.cwd(), "public", "uploads", "receipts")

async function ensureDirectories() {
  await mkdir(dataDirectory, { recursive: true })
  await mkdir(uploadDirectory, { recursive: true })
}

async function readReceiptStore() {
  await ensureDirectories()

  try {
    const raw = await readFile(receiptStorePath, "utf8")
    const parsed = JSON.parse(raw) as unknown

    return storedReceiptSchema.array().parse(parsed)
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return []
    }

    throw error
  }
}

async function writeReceiptStore(receipts: StoredReceipt[]) {
  await ensureDirectories()
  await writeFile(receiptStorePath, JSON.stringify(receipts, null, 2), "utf8")
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeAmount(value: number) {
  return Math.round(value * 100)
}

function buildReceiptFingerprint(receipt: ReceiptData | StoredReceipt) {
  const merchant = normalizeText(receipt.merchantName)
  const officialReceiptNumber = normalizeText(receipt.officialReceiptNumber)
  const purchaseDate = normalizeText(receipt.purchaseDate)

  if (!merchant || !officialReceiptNumber || !purchaseDate) {
    return null
  }

  return [
    merchant,
    officialReceiptNumber,
    purchaseDate,
    normalizeAmount(receipt.totalAmountDue),
  ].join(":")
}

function safeExtensionFromName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase()

  if (!extension) {
    return ".bin"
  }

  return extension.replace(/[^a-z0-9.]/g, "") || ".bin"
}

export async function listReceipts() {
  const receipts = await readReceiptStore()

  return receipts.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

export async function persistReceipt(params: {
  sourceFileName: string
  sourceMimeType: string
  fileBuffer: Buffer
  extractedReceipt: ReceiptData
}) {
  await ensureDirectories()

  const receipts = await readReceiptStore()
  const sourceFileHash = crypto
    .createHash("sha256")
    .update(params.fileBuffer)
    .digest("hex")
  const nextFingerprint = buildReceiptFingerprint(params.extractedReceipt)

  const duplicateReceipt = receipts.find((receipt) => {
    if (receipt.sourceFileHash && receipt.sourceFileHash === sourceFileHash) {
      return true
    }

    if (!nextFingerprint) {
      return false
    }

    return buildReceiptFingerprint(receipt) === nextFingerprint
  })

  if (duplicateReceipt) {
    return {
      receipt: duplicateReceipt,
      duplicate: true as const,
    }
  }

  const id = crypto.randomUUID()
  const extension = safeExtensionFromName(params.sourceFileName)
  const storedFileName = `${id}${extension}`
  const storedFilePath = path.join(uploadDirectory, storedFileName)

  await writeFile(storedFilePath, params.fileBuffer)

  const storedReceipt: StoredReceipt = {
    id,
    sourceFileName: params.sourceFileName,
    sourceFileUrl: `/uploads/receipts/${storedFileName}`,
    sourceMimeType: params.sourceMimeType,
    sourceFileHash,
    createdAt: new Date().toISOString(),
    reviewStatus: "new",
    ...params.extractedReceipt,
  }

  receipts.unshift(storedReceipt)
  await writeReceiptStore(receipts)

  return {
    receipt: storedReceipt,
    duplicate: false as const,
  }
}

export async function bulkUpdateReceipts(params: {
  ids: string[]
  reviewStatus?: StoredReceipt["reviewStatus"]
  category?: string
}) {
  const idSet = new Set(params.ids)

  if (idSet.size === 0) {
    return []
  }

  const nextCategory = params.category?.trim()
  const receipts = await readReceiptStore()
  const updated: StoredReceipt[] = []

  const nextReceipts = receipts.map((receipt) => {
    if (!idSet.has(receipt.id)) {
      return receipt
    }

    const nextReceipt: StoredReceipt = {
      ...receipt,
      reviewStatus: params.reviewStatus ?? receipt.reviewStatus,
      items: nextCategory
        ? receipt.items.map((item) => ({ ...item, category: nextCategory }))
        : receipt.items,
    }

    updated.push(nextReceipt)
    return nextReceipt
  })

  await writeReceiptStore(nextReceipts)

  return updated
}
