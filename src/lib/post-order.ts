import type { PublicAuthor } from '@/lib/types'

/**
 * Order for team / seeker / co-founder feeds: posts people can trust come first —
 * named + Mahidol-verified, then named, then anonymous — newest first within each group.
 * An anonymous post stays below named ones even if it's newer.
 */
export function trustRank(author: PublicAuthor): number {
  if (author.anonymous) return 0
  return author.verified ? 2 : 1
}

export function byTrust<T extends { author: PublicAuthor; at: string }>(a: T, b: T): number {
  return trustRank(b.author) - trustRank(a.author) || b.at.localeCompare(a.at)
}
