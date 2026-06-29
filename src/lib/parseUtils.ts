/**
 * Safely parse tags from various formats: JSON array, comma-separated string, or invalid data.
 * Returns string[] in all cases.
 */
export function safeParseTags(tags: string | null | undefined): string[] {
  if (!tags) return []

  // Already an array (shouldn't happen from DB but just in case)
  if (Array.isArray(tags)) return tags

  const trimmed = String(tags).trim()
  if (!trimmed) return []

  // Try JSON parse first
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.filter((item: unknown) => typeof item === 'string')
    }
    // Single string wrapped in quotes
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    // Not valid JSON — try comma-separated
    return trimmed.split(',').map(s => s.trim()).filter(Boolean)
  }
}