// Shared shapes for imported opportunities.

/** Who can apply. Empty array = the listing didn't say. */
export type Level = 'university' | 'public' | 'high_school'

/** One listing, already cleaned and normalised (built from a POST /api/imports item). */
export type SourceItem = {
  source_id: string
  source_url: string
  /** Where the listing was found (site name or host), shown on the admin card. */
  source_type: string
  title: string
  organizer: string | null
  description: string | null
  poster_url: string | null
  /** Organiser's own registration link when known (else null → falls back to source_url). */
  apply_url: string | null
  /** Exact closing moment (ISO, with offset) when known. */
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
  /** Still accepting applications. */
  open: boolean
  /** Extra words used for relevance only (themes, categories, tags). */
  hints?: string[]
  /** Relevance nudge. */
  typeBonus?: number
  raw: unknown
}
