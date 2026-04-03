const XENDIT_API_URL = "https://api.xendit.co"
const XENDIT_CUSTOMER_API_VERSION = "2020-10-31"

type XenditErrorPayload = {
  error_code?: string
  message?: string
}

type XenditCustomerPayload = {
  reference_id: string
  type: "INDIVIDUAL"
  individual_detail: {
    given_names: string
    surname?: string
  }
  email: string
  metadata?: Record<string, string>
}

export type XenditCustomer = {
  id: string
}

export type XenditRecurringPlan = {
  id: string
  status: "ACTIVE" | "INACTIVE" | "PENDING" | "REQUIRES_ACTION"
  customer_id: string
  actions?: Array<{
    action: string
    url: string
    url_type: "WEB"
    method: "GET" | "POST"
  }>
}

function getSecretKey() {
  const secretKey = process.env.XENDIT_SECRET_KEY

  if (!secretKey) {
    throw new Error("XENDIT_SECRET_KEY is required.")
  }

  return secretKey
}

function getBasicAuthHeader() {
  const token = Buffer.from(`${getSecretKey()}:`).toString("base64")
  return `Basic ${token}`
}

async function xenditRequest<T>(
  path: string,
  init: RequestInit,
  headers?: HeadersInit
) {
  const response = await fetch(`${XENDIT_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/json",
      ...headers,
      ...init.headers,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | XenditErrorPayload
      | null

    throw new Error(
      payload?.message ??
        payload?.error_code ??
        `Xendit request failed with ${response.status}.`
    )
  }

  return (await response.json()) as T
}

export async function createCustomer(payload: XenditCustomerPayload) {
  return xenditRequest<XenditCustomer>(
    "/customers",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      "api-version": XENDIT_CUSTOMER_API_VERSION,
      "idempotency-key": payload.reference_id,
    }
  )
}

type CreateRecurringPlanPayload = {
  reference_id: string
  customer_id: string
  recurring_action: "PAYMENT"
  currency: string
  amount: number
  schedule: {
    reference_id: string
    interval: "DAY" | "WEEK" | "MONTH"
    interval_count: number
    total_recurrence?: number | null
    anchor_date: string
    retry_interval?: "DAY"
    retry_interval_count?: number
    total_retry?: number
  }
  immediate_action_type?: "FULL_AMOUNT"
  failed_cycle_action?: "RESUME" | "STOP"
  success_return_url: string
  failure_return_url: string
  description: string
  metadata?: Record<string, string>
  items: Array<{
    type: "DIGITAL_SERVICE"
    name: string
    net_unit_amount: number
    quantity: number
    description?: string
  }>
}

export async function createRecurringPlan(
  payload: CreateRecurringPlanPayload
) {
  return xenditRequest<XenditRecurringPlan>("/recurring/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function deactivateRecurringPlan(planId: string) {
  return xenditRequest<XenditRecurringPlan>(
    `/recurring/plans/${planId}/deactivate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  )
}

export async function getRecurringPlan(planId: string) {
  return xenditRequest<XenditRecurringPlan>(`/recurring/plans/${planId}`, {
    method: "GET",
  })
}
