type ErrorBody = { detail?: string; error?: string }

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
  })

  let body: ErrorBody = {}
  try {
    body = await response.json()
  } catch {
    // Some infrastructure errors do not include JSON.
  }

  if (!response.ok) {
    throw new Error(body.detail || body.error || 'Request failed.')
  }
  return body as T
}
