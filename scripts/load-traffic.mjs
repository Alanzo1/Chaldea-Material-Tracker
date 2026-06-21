#!/usr/bin/env node

/**
 * Simple high-traffic simulator for app API endpoints.
 *
 * Usage examples:
 *   node scripts/load-traffic.mjs
 *   node scripts/load-traffic.mjs --base-url http://localhost:3000 --duration 30 --concurrency 40
 *   node scripts/load-traffic.mjs --base-url https://your-app.vercel.app --concurrency 80 --duration 60
 */

const DEFAULTS = {
  baseUrl: "http://localhost:3000",
  durationSeconds: 20,
  concurrency: 25,
  timeoutMs: 8_000,
  healthPath: "/api/health",
}

const DEFAULT_SERVANT_IDS = [1, 6, 13, 60, 84, 120, 150, 188, 215, 230]
const DEFAULT_MATERIAL_IDS = [6503, 6505, 6507, 6513, 6529, 6531, 6551, 7101, 7105, 6999]

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULTS.baseUrl,
    durationSeconds: DEFAULTS.durationSeconds,
    concurrency: DEFAULTS.concurrency,
    timeoutMs: DEFAULTS.timeoutMs,
    healthPath: DEFAULTS.healthPath,
    skipPreflight: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }

    if (arg === "--base-url" && next) {
      options.baseUrl = String(next).trim().replace(/\/+$/, "")
      i += 1
      continue
    }

    if (arg === "--duration" && next) {
      options.durationSeconds = Math.max(1, Number.parseInt(next, 10) || DEFAULTS.durationSeconds)
      i += 1
      continue
    }

    if (arg === "--concurrency" && next) {
      options.concurrency = Math.max(1, Number.parseInt(next, 10) || DEFAULTS.concurrency)
      i += 1
      continue
    }

    if (arg === "--timeout" && next) {
      options.timeoutMs = Math.max(250, Number.parseInt(next, 10) || DEFAULTS.timeoutMs)
      i += 1
      continue
    }

    if (arg === "--health-path" && next) {
      const value = String(next).trim()
      options.healthPath = value.startsWith("/") ? value : `/${value}`
      i += 1
      continue
    }

    if (arg === "--skip-preflight") {
      options.skipPreflight = true
      continue
    }
  }

  return options
}

function printHelp() {
  console.log(`Load Traffic Script

Options:
  --base-url      Base app URL (default: ${DEFAULTS.baseUrl})
  --duration      Test duration in seconds (default: ${DEFAULTS.durationSeconds})
  --concurrency   Number of parallel workers (default: ${DEFAULTS.concurrency})
  --timeout       Request timeout in ms (default: ${DEFAULTS.timeoutMs})
  --health-path   Health endpoint path (default: ${DEFAULTS.healthPath})
  --skip-preflight Skip startup health check
  --help          Show this help

Examples:
  node scripts/load-traffic.mjs
  node scripts/load-traffic.mjs --base-url http://localhost:3000 --duration 30 --concurrency 50
  node scripts/load-traffic.mjs --base-url http://127.0.0.1:3000 --health-path /api/health
`)
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1)
  )
  return sortedValues[index]
}

function createEndpointPickers(baseUrl) {
  const farmIds = [...DEFAULT_MATERIAL_IDS]
  const servantIds = [...DEFAULT_SERVANT_IDS]

  return [
    () => `${baseUrl}/api/atlas/servants-index`,
    () => `${baseUrl}/api/atlas/materials-index`,
    () => `${baseUrl}/api/atlas/material-farming?itemId=${farmIds[Math.floor(Math.random() * farmIds.length)]}&limit=1`,
    () => `${baseUrl}/api/atlas/material-farming?itemId=${farmIds[Math.floor(Math.random() * farmIds.length)]}&limit=6`,
    () => `${baseUrl}/api/atlas/servant/${servantIds[Math.floor(Math.random() * servantIds.length)]}`,
  ]
}

async function timedFetch(url, timeoutMs) {
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "cache-control": "no-cache",
      },
    })
    const durationMs = performance.now() - startedAt
    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      timedOut: false,
    }
  } catch (error) {
    const durationMs = performance.now() - startedAt
    const timedOut = error?.name === "AbortError"
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "code" in error.cause
        ? String(error.cause.code)
        : ""

    return {
      ok: false,
      status: timedOut ? 408 : 0,
      durationMs,
      timedOut,
      error: error instanceof Error ? error.message : String(error),
      errorCode,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runPreflight(baseUrl, healthPath, timeoutMs) {
  const healthUrl = `${baseUrl}${healthPath}`
  const result = await timedFetch(healthUrl, Math.min(timeoutMs, 4_000))

  if (!result.ok) {
    const codeSuffix = result.errorCode ? ` code=${result.errorCode}` : ""
    throw new Error(
      `Preflight failed for ${healthUrl}: status=${result.status}${codeSuffix} error=${result.error || "unknown"}`
    )
  }

  console.log(`Preflight OK: ${healthUrl} (${result.durationMs.toFixed(1)}ms)`)
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    process.exit(0)
  }

  if (!options.skipPreflight) {
    await runPreflight(options.baseUrl, options.healthPath, options.timeoutMs)
  }

  const endpointPickers = createEndpointPickers(options.baseUrl)
  const startTime = Date.now()
  const endTime = startTime + options.durationSeconds * 1000

  const allDurations = []
  const endpointDurations = new Map()
  const statusCounts = new Map()
  const endpointCounts = new Map()
  const failures = []

  let totalRequests = 0
  let totalSuccess = 0
  let totalTimeouts = 0

  async function workerLoop() {
    while (Date.now() < endTime) {
      const picker = endpointPickers[Math.floor(Math.random() * endpointPickers.length)]
      const endpoint = picker()

      const result = await timedFetch(endpoint, options.timeoutMs)
      totalRequests += 1
      if (result.ok) totalSuccess += 1
      if (result.timedOut) totalTimeouts += 1

      allDurations.push(result.durationMs)
      if (!endpointDurations.has(endpoint)) endpointDurations.set(endpoint, [])
      endpointDurations.get(endpoint).push(result.durationMs)

      endpointCounts.set(endpoint, (endpointCounts.get(endpoint) ?? 0) + 1)
      statusCounts.set(result.status, (statusCounts.get(result.status) ?? 0) + 1)

      if (!result.ok) {
        failures.push({
          endpoint,
          status: result.status,
          error: result.error ?? "",
          errorCode: result.errorCode ?? "",
          durationMs: result.durationMs,
        })
      }
    }
  }

  console.log(`Starting load test
  baseUrl:      ${options.baseUrl}
  duration:     ${options.durationSeconds}s
  concurrency:  ${options.concurrency}
  timeout:      ${options.timeoutMs}ms
`)

  await Promise.all(Array.from({ length: options.concurrency }, () => workerLoop()))

  const sorted = [...allDurations].sort((a, b) => a - b)
  const elapsedSeconds = Math.max(0.001, (Date.now() - startTime) / 1000)
  const requestsPerSecond = totalRequests / elapsedSeconds
  const errorRate = totalRequests > 0 ? ((totalRequests - totalSuccess) / totalRequests) * 100 : 0

  console.log("==== Summary ====")
  console.log(`Total requests:   ${totalRequests}`)
  console.log(`Success:          ${totalSuccess}`)
  console.log(`Failures:         ${totalRequests - totalSuccess}`)
  console.log(`Timeouts:         ${totalTimeouts}`)
  console.log(`Error rate:       ${errorRate.toFixed(2)}%`)
  console.log(`Req/sec:          ${requestsPerSecond.toFixed(2)}`)
  console.log(`Latency p50:      ${percentile(sorted, 50).toFixed(1)}ms`)
  console.log(`Latency p95:      ${percentile(sorted, 95).toFixed(1)}ms`)
  console.log(`Latency p99:      ${percentile(sorted, 99).toFixed(1)}ms`)

  console.log("\n==== Status Counts ====")
  const sortedStatuses = [...statusCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  sortedStatuses.forEach(([status, count]) => {
    console.log(`${status}: ${count}`)
  })

  console.log("\n==== Endpoint Breakdown ====")
  const sortedEndpoints = [...endpointCounts.entries()].sort((a, b) => b[1] - a[1])
  sortedEndpoints.forEach(([endpoint, count]) => {
    const durations = [...(endpointDurations.get(endpoint) ?? [])].sort((a, b) => a - b)
    console.log(`${endpoint}`)
    console.log(`  requests=${count} p50=${percentile(durations, 50).toFixed(1)}ms p95=${percentile(durations, 95).toFixed(1)}ms`)
  })

  if (failures.length) {
    console.log("\n==== Sample Failures (up to 10) ====")
    failures.slice(0, 10).forEach((failure, index) => {
      console.log(
        `${index + 1}. status=${failure.status} duration=${failure.durationMs.toFixed(1)}ms endpoint=${failure.endpoint}${failure.errorCode ? ` code=${failure.errorCode}` : ""}${failure.error ? ` error=${failure.error}` : ""}`
      )
    })
  }
}

run().catch((error) => {
  console.error("Load test failed:", error)
  process.exit(1)
})
