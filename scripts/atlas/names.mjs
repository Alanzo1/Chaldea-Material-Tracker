// JP data comes from Atlas's English exports; `originalName` holds the Japanese name.
// Kept only when it differs, so NA output (where the two match or it is absent) is unchanged.
export function originalName(entity, key = "originalName") {
  const original = String(entity?.originalName ?? "").trim()
  return original && original !== String(entity?.name ?? "").trim() ? { [key]: original } : {}
}
