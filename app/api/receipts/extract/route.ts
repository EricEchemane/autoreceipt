import { zodTextFormat } from "openai/helpers/zod"
import OpenAI from "openai"

import { getOpenAIClient } from "@/lib/openai"
import { receiptSchema } from "@/lib/receipt-schema"
import { persistReceipt } from "@/lib/receipt-store"

export const runtime = "nodejs"

const model = "gpt-5.4-mini"

const extractionInstructions = `
You extract structured accounting data from a single receipt.

Return a JSON object matching the provided schema exactly.

Rules:
- Extract the merchant name.
- Extract the TIN number if present. Use an empty string when not visible.
- Extract the official receipt number if present. Use an empty string when not visible.
- Extract total amount due, taxable sales, and VAT amount as numbers only.
- Extract purchase date as a readable date string exactly as shown when possible.
- For each line item, extract description, quantity, price, category, and taxableSales.
- Use a sensible bookkeeping category for each item, such as Inventory, Meals, Office Supplies, Operations, Transport, Utilities, or Uncategorized.
- If a numeric value is not visible, use 0.
- If a text field is not visible, use an empty string.
- Add a short notes field describing any ambiguity or assumptions.
- Set confidence from 0 to 100 based on how legible and complete the receipt appears.
- Do not include markdown fences or any extra keys.
`.trim()

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function inferMimeType(file: File) {
  if (file.type) {
    return file.type
  }

  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith(".png")) return "image/png"
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
    return "image/jpeg"
  if (lowerName.endsWith(".webp")) return "image/webp"
  if (lowerName.endsWith(".pdf")) return "application/pdf"

  return "application/octet-stream"
}

function buildReceiptInput(file: File, base64: string) {
  const mimeType = inferMimeType(file)

  if (mimeType.startsWith("image/")) {
    return {
      type: "input_image" as const,
      detail: "auto" as const,
      image_url: `data:${mimeType};base64,${base64}`,
    }
  }

  return {
    type: "input_file" as const,
    filename: file.name,
    file_data: base64,
  }
}

export async function POST(request: Request) {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return Response.json(
      { error: "Invalid multipart form data." },
      { status: 400 }
    )
  }

  const fileEntry = formData.get("file")

  if (!(fileEntry instanceof File)) {
    return Response.json(
      { error: "Receipt file is required." },
      { status: 400 }
    )
  }

  let client: OpenAI

  try {
    client = getOpenAIClient()
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OpenAI client could not be created.",
      },
      { status: 500 }
    )
  }

  const arrayBuffer = await fileEntry.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)
  const base64 = fileBuffer.toString("base64")
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(createSseEvent(event, payload)))
      }

      send("status", {
        stage: "received",
        progress: 10,
        message: `Received ${fileEntry.name}`,
      })

      try {
        const response = client.responses.stream(
          {
            model,
            instructions: extractionInstructions,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: "Extract all fields from this receipt and categorize each line item.",
                  },
                  buildReceiptInput(fileEntry, base64),
                ],
              },
            ],
            text: {
              format: zodTextFormat(receiptSchema, "receipt_extraction"),
              verbosity: "low",
            },
          },
          { signal: request.signal }
        )

        send("status", {
          stage: "uploading",
          progress: 30,
          message: "Receipt sent to OpenAI for OCR and extraction.",
        })

        response.on("response.output_text.delta", (event) => {
          send("text_delta", {
            delta: event.delta,
            snapshot: event.snapshot,
            progress: 65,
          })
        })

        response.on("response.completed", () => {
          send("status", {
            stage: "finalizing",
            progress: 90,
            message: "Finalizing the structured receipt payload.",
          })
        })

        const finalResponse = await response.finalResponse()
        const parsedReceipt = receiptSchema.parse(finalResponse.output_parsed)
        const persistedReceipt = await persistReceipt({
          sourceFileName: fileEntry.name,
          sourceMimeType: inferMimeType(fileEntry),
          fileBuffer,
          extractedReceipt: parsedReceipt,
        })

        send("receipt", {
          receipt: persistedReceipt.receipt,
          duplicate: persistedReceipt.duplicate,
          progress: 100,
        })
        send("done", { ok: true })
      } catch (error) {
        send("error", {
          message:
            error instanceof Error
              ? error.message
              : "Receipt extraction failed unexpectedly.",
        })
      } finally {
        controller.close()
      }
    },
    cancel() {
      request.signal.throwIfAborted?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  })
}
