type ErrorPayload = {
  error?: string
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init)
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null

  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed.")
  }

  return (payload ?? {}) as T
}
