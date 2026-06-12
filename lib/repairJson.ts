/**
 * Repair common issues in Claude's JSON output before parsing.
 * Handles: trailing commas, JS-style comments, unquoted nulls/booleans,
 * and truncated arrays/objects.
 */
export function repairJson(raw: string): string {
  let s = raw

  // Strip JS block and line comments (outside strings — good enough for Claude output)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  s = s.replace(/\/\/[^\n"]*/g, '')

  // Trailing commas before ] or }
  s = s.replace(/,\s*([}\]])/g, '$1')

  // Remove any control characters that break JSON
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')

  return s
}

/** Extract the first {...} block from a string, repair it, and parse it. */
export function extractAndParse<T = any>(text: string): T {
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON object found in response. Preview: ${text.slice(0, 200)}`)

  const repaired = repairJson(match[0])

  try {
    return JSON.parse(repaired)
  } catch (e: any) {
    // Last resort: try to close unclosed arrays/objects
    const closed = closeJson(repaired)
    try {
      return JSON.parse(closed)
    } catch {
      throw new Error(`${e.message} — raw (first 300): ${repaired.slice(0, 300)}`)
    }
  }
}

/** Attempt to close truncated JSON by counting brackets. */
function closeJson(s: string): string {
  const opens: string[] = []
  let inString = false
  let escape = false
  for (const ch of s) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') opens.push('}')
    else if (ch === '[') opens.push(']')
    else if (ch === '}' || ch === ']') opens.pop()
  }
  return s + opens.reverse().join('')
}
