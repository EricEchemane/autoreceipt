import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

type StoredFileResult = {
  sourceFileUrl: string
}

function createR2Client() {
  const endpoint = normalizeEndpoint(process.env.R2_ENDPOINT)
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null
  }

  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

function getStorageBucket() {
  return process.env.R2_BUCKET || "receipts"
}

function normalizeEndpoint(rawEndpoint: string | undefined) {
  if (!rawEndpoint) {
    return ""
  }

  const trimmed = rawEndpoint.trim()

  try {
    const url = new URL(trimmed)
    return url.origin
  } catch {
    return trimmed.replace(/\/$/, "")
  }
}

function buildR2PublicUrl(key: string) {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${key}`
  }

  const endpoint = process.env.R2_ENDPOINT
  const bucket = getStorageBucket()

  if (!endpoint) {
    throw new Error("R2_ENDPOINT is missing.")
  }

  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`
}

async function uploadToR2(params: {
  fileBuffer: Buffer
  storedFileName: string
  sourceMimeType: string
}): Promise<StoredFileResult> {
  const client = createR2Client()

  if (!client) {
    throw new Error("Cloudflare R2 is not configured.")
  }

  const storagePath = `source/${params.storedFileName}`
  const bucket = getStorageBucket()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: params.fileBuffer,
      ContentType: params.sourceMimeType,
    })
  )

  return {
    sourceFileUrl: buildR2PublicUrl(storagePath),
  }
}

export async function storeReceiptSourceFile(params: {
  fileBuffer: Buffer
  storedFileName: string
  sourceMimeType: string
}) {
  const useR2 = Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  )

  if (!useR2) {
    throw new Error(
      "Cloudflare R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET."
    )
  }

  return uploadToR2(params)
}
