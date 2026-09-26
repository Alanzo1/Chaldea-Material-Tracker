export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/"
  try {
    const url = new URL(value, "https://local.invalid")
    if (url.origin !== "https://local.invalid" || url.pathname.startsWith("/auth/")) return "/"
    return url.pathname + url.search + url.hash
  } catch { return "/" }
}
