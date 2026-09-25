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
      if (!response.ok) {
        const error = new Error(`Fetch failed (${response.status}): ${url}`)
        error.status = response.status
        throw error
      }
      return await response.json()
    } catch (error) {
      lastError = error
      // 4xx won't change on retry; only retry network errors, timeouts and 5xx.
      if (error.status >= 400 && error.status < 500) break
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

// Concurrent first pass, then one sequential retry of each failure (Atlas is slow on cold cache).
// Returns results in input order plus the indexes that failed both times.
export async function mapWithRetryPass(items, limit, fn) {
  const firstFailed = []
  const results = await mapWithConcurrency(items, limit, (item, index) =>
    fn(item, index).catch(() => {
      firstFailed.push(index)
      return undefined
    })
  )

  const failed = []
  for (const index of firstFailed.sort((a, b) => a - b)) {
    try {
      results[index] = await fn(items[index], index)
    } catch {
      failed.push(index)
    }
  }

  return { results, failed }
}
