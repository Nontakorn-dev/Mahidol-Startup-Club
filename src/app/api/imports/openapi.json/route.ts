import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { CATEGORY_KEYS, ROLE_KEYS } from '@/lib/constants'
import { FORMATS, LEVELS, MAX_ITEMS } from '@/lib/importers/ingest'

// OpenAPI 3.1 description of POST /api/imports — paste the URL into a GPT Action (auth: API key,
// Bearer) or hand it to whatever sends the daily feed. Public: it contains no secrets.
export function GET() {
  const url = { type: 'string', format: 'uri', maxLength: 2000 }
  const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
  const item = {
    type: 'object',
    required: ['title', 'source_url'],
    properties: {
      title: { type: 'string', maxLength: 200, description: 'Official name of the competition / grant / program.' },
      source_url: { ...url, description: 'Page where this listing was found. Unique key: send the same URL again to update it.' },
      apply_url: { ...url, description: "Organiser's own registration link (not an aggregator page)." },
      organizer: { type: 'string', maxLength: 120 },
      category: { type: 'string', enum: CATEGORY_KEYS, description: 'competition | grant | incubation | workshop | team_recruit' },
      summary: { type: 'string', maxLength: 300, description: 'One sentence in Thai for the card.' },
      description: { type: 'string', maxLength: 8000, description: 'Full details in Thai: what it is, benefits, who can apply, how to apply.' },
      deadline: { ...date, description: 'Application closing date, Bangkok time (YYYY-MM-DD, Gregorian year).' },
      deadline_time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'Closing time HH:MM Bangkok time, only if stated (else 23:59 is assumed).' },
      event_start: { ...date, description: 'First day of the event itself.' },
      event_end: { ...date, description: 'Last day of the event itself.' },
      location: { type: 'string', maxLength: 120 },
      format: { type: 'string', enum: FORMATS },
      prize: { type: 'string', maxLength: 200, description: 'Prize money or main benefit.' },
      eligibility: { type: 'string', maxLength: 200, description: 'Who may apply.' },
      levels: { type: 'array', items: { type: 'string', enum: LEVELS }, maxItems: 3 },
      poster_url: { ...url, description: 'Direct link to the poster image (jpg/png/webp).' },
      tags: { type: 'array', items: { type: 'string', enum: ROLE_KEYS }, maxItems: 7, description: 'Skills the event needs.' },
      evidence: { type: 'array', items: url, maxItems: 5, description: 'Official pages used to verify the facts.' },
      confidence: { type: 'number', minimum: 0, maximum: 1, description: 'How sure you are the details are correct.' },
      notes: { type: 'string', maxLength: 1000, description: 'Anything the reviewer should check.' },
      source_name: { type: 'string', maxLength: 60, description: 'Site the listing came from, e.g. "CAMPHUB" or "เว็บผู้จัด".' },
    },
  }
  const result = {
    type: 'object',
    properties: {
      index: { type: 'integer' },
      status: { type: 'string', enum: ['inserted', 'duplicate', 'updated', 'skipped', 'invalid'] },
      id: { type: 'string' },
      reason: { type: 'string' },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  }
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Mahidol Startup Club — opportunity imports',
      version: '1.0.0',
      description: 'Send newly found competitions, grants and programs for Thai university students. Listings wait for admin review before anything is published.',
    },
    servers: [{ url: env.siteUrl }],
    paths: {
      '/api/imports': {
        post: {
          operationId: 'submitOpportunities',
          summary: 'Submit opportunities for admin review',
          description: `Up to ${MAX_ITEMS} items per call. Re-sending an item with the same source_url updates it (e.g. a moved deadline). Invalid optional fields are dropped with a warning.`,
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    run_id: { type: 'string', maxLength: 64, description: 'Optional label for this run, e.g. the date.' },
                    items: { type: 'array', minItems: 1, maxItems: MAX_ITEMS, items: item },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Accepted. Check each result: inserted / duplicate / updated / skipped / invalid.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      run_id: { type: ['string', 'null'] },
                      received: { type: 'integer' },
                      summary: { type: 'object', additionalProperties: { type: 'integer' } },
                      results: { type: 'array', items: result },
                    },
                  },
                },
              },
            },
            '400': { description: 'Body is not valid JSON or items is missing / too long.' },
            '401': { description: 'Missing or wrong Bearer token.' },
            '413': { description: 'Body larger than 1 MB.' },
          },
        },
      },
    },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
  }
  return NextResponse.json(spec, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
