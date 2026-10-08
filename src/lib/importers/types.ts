// Shared shapes for every opportunity source.

/** Who can apply. Empty array = the source didn't say. */
export type Level = 'university' | 'public' | 'high_school'

/** What a source adapter returns — one listing, already cleaned and normalised. */
export type SourceItem = {
  source_id: string
  source_url: string
  /** Source's own type label (hackathon, camp_workshop, COMPETITION, …) for the admin card. */
  source_type: string
  title: string
  organizer: string | null
  description: string | null
  poster_url: string | null
  /** Organiser's own registration link when known (else null → falls back to source_url). */
  apply_url: string | null
  /** Exact closing moment (ISO, with offset) when the source gives a time. */
  deadline_at: string | null
  /** Bangkok calendar date the application closes (YYYY-MM-DD). */
  deadline: string | null
  event_start: string | null
  event_end: string | null
  location: string | null
  format: 'onsite' | 'online' | 'hybrid' | null
  prize: string | null
  eligibility: string | null
  levels: Level[]
  /** Still accepting applications according to the source. */
  open: boolean
  /** Extra words used for relevance only (themes, categories, tags). */
  hints?: string[]
  /** Source-specific relevance nudge (e.g. business case +3). */
  typeBonus?: number
  /** Warnings for the reviewer: needs_verification, internal_only, … */
  flags?: string[]
  /** Set by the source when the listing must not reach the queue (reason shown in "ข้ามอัตโนมัติ"). */
  skip?: string
  /** Change marker (source's updated time). Unchanged known items aren't re-fetched. */
  version?: string | null
  raw: unknown
}

export type KnownRow = { status: string; version: string | null }

export type FetchContext = {
  /** Rows already stored for this source, by source_id. */
  known: Map<string, KnownRow>
  /** Stop starting new requests after this time (ms since epoch). */
  until: number
}

export type FetchResult = {
  items: SourceItem[]
  /** Known source_ids seen in the listing but not re-fetched because they didn't change. */
  seen: string[]
  /** Listing entries looked at (for the run log). */
  scanned: number
}

export type Trust = 'high' | 'medium'

export type Source = {
  key: string
  name: string
  homepage: string
  trust: Trust
  /** Shown to admins: how this source is collected and how far to trust it. */
  note: string
  fetch(ctx: FetchContext): Promise<FetchResult>
}
