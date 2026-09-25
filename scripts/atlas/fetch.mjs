const DEFAULT_TIMEOUT_MS = 20000
const DEFAULT_RETRIES = 2
// Identify ourselves so Atlas Academy can see (and contact) who is calling.
const USER_AGENT = "Chaldea-Material-Tracker (+https://github.com/Alanzo1/Chaldea-Material-Tracker)"

export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new Error(`Fetch failed (${response.status}): ${url}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
      }
    }
  }
  throw lastError
}

export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
