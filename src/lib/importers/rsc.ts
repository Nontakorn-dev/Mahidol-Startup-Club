// Reading data out of Next.js App Router pages (React Server Components payload).
//
// The page streams its payload as `self.__next_f.push([1,"..."])` chunks. Joined, they form rows:
//   `<hex id>:<json or tagged value>\n`   or   `<hex id>:T<hex byte length>,<raw utf-8 text>`
// Long strings are moved into those `T` text rows and the JSON keeps a reference like "$2c".
// Text rows have no terminator — the next row starts exactly <length> bytes later — so they must
// be read in order. (Scanning with a regex mistakes a description ending in "...2569" followed by
// row "29:T…" for row "6929", which is how "$2c" ended up as event descriptions.)

export function rscPayload(html: string): string {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`) as string).join('')
}

/** All `T` text rows of a payload, keyed by row id. */
export function rscTextRows(payload: string): Map<string, string> {
  const rows = new Map<string, string>()
  const b = Buffer.from(payload, 'utf8')
  const COLON = 0x3a
  const NL = 0x0a
  let pos = 0
  while (pos < b.length) {
    const colon = b.indexOf(COLON, pos)
    if (colon < 0) break
    const id = b.subarray(pos, colon).toString('latin1')
    if (!/^[0-9a-f]{1,6}$/.test(id)) {
      // Out of sync (unexpected format) — resume at the next line.
      const nl = b.indexOf(NL, pos)
      if (nl < 0) break
      pos = nl + 1
      continue
    }
    if (b[colon + 1] === 0x54 /* T */) {
      const comma = b.indexOf(0x2c, colon)
      const len = parseInt(b.subarray(colon + 2, comma).toString('latin1'), 16)
      if (comma < 0 || !Number.isFinite(len)) break
      rows.set(id, b.subarray(comma + 1, comma + 1 + len).toString('utf8'))
      pos = comma + 1 + len
    } else {
      const nl = b.indexOf(NL, colon)
      pos = nl < 0 ? b.length : nl + 1
    }
  }
  return rows
}

/** True for values that are still RSC references / placeholders rather than real data. */
export const isRscRef = (v: unknown) => typeof v === 'string' && (v === '$undefined' || /^\$[0-9a-fA-F]{1,6}$/.test(v) || /^\$[A-Z@]/.test(v))

/** Replace "$2c"-style references (deeply) with their text; unresolvable ones become null. */
export function resolveRefs<T>(value: T, rows: Map<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (v === '$undefined') return null
      const m = v.match(/^\$([0-9a-f]{1,6})$/)
      if (m) return rows.get(m[1]) ?? null
      if (/^\$[A-Z@]/.test(v)) return null // other RSC tags (dates "$D…", promises "$@…")
      if (v.startsWith('$$')) return v.slice(1) // escaped literal "$"
      return v
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}

/** Parse the JSON array/object that starts at `start` (balanced scan, string-aware). */
export function jsonAt(text: string, start: number): unknown {
  const open = text[start]
  if (open !== '[' && open !== '{') throw new Error('jsonAt: not at an array/object')
  let depth = 0
  let inStr = false
  for (let j = start; j < text.length; j++) {
    const c = text[j]
    if (inStr) {
      if (c === '\\') j++
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '[' || c === '{') depth++
    else if ((c === ']' || c === '}') && --depth === 0) return JSON.parse(text.slice(start, j + 1))
  }
  throw new Error('jsonAt: unterminated value')
}

/** The JSON value right after `"key":` (first occurrence), or undefined. */
export function jsonAfterKey(text: string, key: string, from = 0): unknown {
  const k = `"${key}":`
  const i = text.indexOf(k, from)
  if (i < 0) return undefined
  return jsonAt(text, i + k.length)
}
