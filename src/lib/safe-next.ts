/**
 * The one check for post-login / post-action redirect targets (`?next=`, form `next`).
 * Only same-site paths pass. A plain `startsWith('/') && !startsWith('//')` test lets
 * `/\evil.com` through — browsers read `\` as `/`, so that is `//evil.com`, an open redirect.
 */
export function isSafePath(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false
  if (!raw.startsWith('/') || raw.startsWith('//')) return false
  // Backslashes and control characters (tab/newline are stripped by URL parsers) never belong in our paths.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return false
  try {
    const base = 'https://mahidolstartup.invalid'
    return new URL(raw, base).origin === base
  } catch {
    return false
  }
}

export function safeNext(raw: unknown, fallback = '/'): string {
  return isSafePath(raw) ? raw : fallback
}
