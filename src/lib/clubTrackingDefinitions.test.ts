import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  approveClubTrackingDefinition,
  approveClubTrackingStandardMapping,
  approveStandardMapping,
  createClubTrackingDefinitionDraft,
  deleteUnusedClubTrackingDefinitionDraft,
  findClubTrackingDefinitionDuplicates,
  getActiveSelectableCustomObservationsForTeam,
  getClubTrackingReportingIdentity,
  getClubDefinitionLocalSelectionEligibility,
  getSelectedClubTrackingDefinitionForMatchDay,
  isClubTrackingDefinitionVisibleToTeam,
  MAX_CLASSIC_CUSTOM_OBSERVATIONS,
  observationContributesToStandardReporting,
  normalizeClubTrackingDefinitionName,
  proposeClubTrackingDefinitionMapping,
  rejectClubTrackingDefinition,
  rejectClubTrackingStandardMapping,
  retireClubTrackingDefinition,
  restoreClubTrackingDefinition,
  searchExistingTrackingDefinitions,
  submitClubTrackingDefinitionForReview,
  updateClubTrackingDefinition,
  validateClassicObservationSelectionCounts,
  validateClubTrackingDefinitionVisibility,
  validateCustomObservationForNewMatchSelection,
  validateMatchDayEventTypeIdentityShape,
  validatePureCustomSelectionIdentity,
} from '@/lib/clubTrackingDefinitions'

vi.mock('@/lib/auth', () => ({ isClerkEnabled: () => false }))
vi.mock('@/lib/permissions', () => ({ canManageMatchDay: vi.fn(async () => true), canManageTeamData: vi.fn(async () => true) }))

const standardEvent = { id: 'event-1', name: 'Forward pass completed', normalizedName: 'completed forward pas', description: null, benchmarkable: true }
const standardPattern = { id: 'pattern-1', name: 'Third player combination', normalizedName: 'combination player third', description: null, aliases: [], outcomes: [{ id: 'outcome-1' }] }

function createDb(overrides: Record<string, unknown> = {}) {
  const state = {
    membershipRole: 'OWNER',
    definitions: [] as Array<Record<string, unknown>>,
    teams: [{ id: 'team-1', clubId: 'club-1' }, { id: 'team-2', clubId: 'club-1' }, { id: 'team-x', clubId: 'club-x' }],
    usage: 0,
    globalEventDuplicate: null as null | { id: string; name: string; normalizedName: string },
    clubDuplicate: null as null | { id: string; name: string; kind: string },
  }
  const db = {
    state,
    clubMembership: {
      findUnique: vi.fn(async () => state.membershipRole ? { role: state.membershipRole, teamAssignments: [{ teamId: 'team-1' }] } : null),
      findMany: vi.fn(async () => state.membershipRole ? [{ role: state.membershipRole, club: { id: 'club-1', name: 'Club 1' }, createdAt: new Date('2026-01-01') }] : []),
    },
    eventDefinition: {
      findMany: vi.fn(async () => [standardEvent]),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.normalizedName && state.globalEventDuplicate) return state.globalEventDuplicate
        if (where.id === 'event-1') return { id: 'event-1', benchmarkable: true }
        return null
      }),
      findUnique: vi.fn(async () => ({ benchmarkable: true })),
    },
    trackingPatternDefinition: {
      findMany: vi.fn(async () => [standardPattern]),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => where.id === 'pattern-1' ? standardPattern : null),
      findUnique: vi.fn(async () => ({ benchmarkable: false })),
    },
    team: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.teams.find((team) => team.id === where.id) ?? null),
    },
    clubTrackingDefinition: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => state.definitions.filter((definition) => matchesWhere(definition, where))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.slug) return null
        if (where.normalizedName && state.clubDuplicate) return state.clubDuplicate
        const existing = state.definitions.find((definition) => matchesWhere(definition, where))
        if (existing) return existing
        if ((where.id as { not?: string } | undefined)?.not) return null
        return null
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.definitions.find((definition) => definition.id === where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { id: `definition-${state.definitions.length + 1}`, mappingRevision: 1, active: true, mappedEventDefinition: data.mappedEventDefinitionId ? { benchmarkable: true } : null, mappedPatternDefinition: data.mappedPatternDefinitionId ? standardPattern : null, ...data }; state.definitions.push(row); return { id: row.id } }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.definitions.find((definition) => definition.id === where.id)
        if (row) {
          Object.entries(data).forEach(([key, value]) => { if (value !== undefined) row[key] = typeof value === 'object' && value && 'increment' in value ? Number(row[key] ?? 0) + Number(value.increment) : value })
        }
        return row
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => { state.definitions = state.definitions.filter((definition) => definition.id !== where.id); return { id: where.id } }),
    },
    submittedMatchEvent: { findMany: vi.fn(async () => Array.from({ length: state.usage }, () => ({ createdAt: new Date('2026-01-01'), matchDay: { teamId: 'team-1' } }))) },
    matchEvent: { findMany: vi.fn(async () => []) },
    matchDayEventType: { findFirst: vi.fn(async ({ where }: { where: { clubTrackingDefinitionId?: string | null } }) => ({ clubTrackingDefinition: state.definitions.find((definition) => definition.id === where.clubTrackingDefinitionId) ?? null })) },
    submittedTrackingPatternObservation: { findMany: vi.fn(async () => []) },
    matchTrackingPatternObservation: { findMany: vi.fn(async () => []) },
    ...overrides,
  }
  return db as never
}

function matchesWhere(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR' && Array.isArray(value)) return value.some((item) => matchesWhere(row, item as Record<string, unknown>))
    if (value && typeof value === 'object' && 'not' in value) return row[key] !== (value as { not: unknown }).not
    if (value && typeof value === 'object' && 'in' in value && Array.isArray((value as { in: unknown[] }).in)) return (value as { in: unknown[] }).in.includes(row[key])
    return row[key] === value
  })
}

async function tokenFor(db: never, role = 'OWNER', query = 'Break the line') {
  ;(db as { state: { membershipRole: string } }).state.membershipRole = role
  const search = await searchExistingTrackingDefinitions({ db, userId: 'coach-1', clubId: 'club-1', query })
  if (!search.ok) throw new Error(search.reason)
  return search.value.searchToken
}

describe('club tracking definitions governance', () => {
  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com'
  })

  it('normalizes case, punctuation and deterministic plurals', () => {
    expect(normalizeClubTrackingDefinitionName('  Break-the-lines! ')).toBe('break line the')
  })

  it('lets coaches create drafts and submit for owner review', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'COACH')
    const created = await createClubTrackingDefinitionDraft({ db, userId: 'coach-1', input: { clubId: 'club-1', kind: 'EVENT_ALIAS', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT' } })
    expect(created).toMatchObject({ ok: true, value: { status: 'DRAFT' } })
    const submitted = await submitClubTrackingDefinitionForReview({ db, userId: 'coach-1', definitionId: 'definition-1' })
    expect(submitted.ok).toBe(true)
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].status).toBe('PENDING_REVIEW')
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].submittedAt).toBeInstanceOf(Date)
  })

  it('requires rejection feedback and stores rejection audit fields', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'COACH', 'Lock the six')
    await createClubTrackingDefinitionDraft({ db, userId: 'coach-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Lock the six', searchToken, proposalType: 'EVENT' } })
    await submitClubTrackingDefinitionForReview({ db, userId: 'coach-1', definitionId: 'definition-1' })
    ;(db as { state: { membershipRole: string } }).state.membershipRole = 'OWNER'
    await expect(rejectClubTrackingDefinition({ db, userId: 'owner-1', definitionId: 'definition-1', reason: '' })).resolves.toMatchObject({ ok: false })
    await expect(rejectClubTrackingDefinition({ db, userId: 'owner-1', definitionId: 'definition-1', reason: 'Too broad for one event.' })).resolves.toMatchObject({ ok: true })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0]).toMatchObject({ status: 'REJECTED', rejectedByUserId: 'owner-1', rejectionReason: 'Too broad for one event.' })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].rejectedAt).toBeInstanceOf(Date)
  })

  it('lets a coach edit and resubmit their rejected definition', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'COACH', 'Lock the six')
    await createClubTrackingDefinitionDraft({ db, userId: 'coach-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Lock the six', searchToken, proposalType: 'EVENT' } })
    ;(db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].status = 'REJECTED'
    ;(db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].rejectionReason = 'Needs clearer wording.'
    ;(db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].rejectedByUserId = 'owner-1'
    ;(db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].rejectedAt = new Date('2026-01-01')
    await expect(updateClubTrackingDefinition({ db, userId: 'coach-1', definitionId: 'definition-1', updates: { guidance: 'One observable event only.' } })).resolves.toMatchObject({ ok: true })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0]).toMatchObject({ guidance: 'One observable event only.', rejectionReason: null, rejectedByUserId: null, rejectedAt: null })
    await expect(submitClubTrackingDefinitionForReview({ db, userId: 'coach-1', definitionId: 'definition-1' })).resolves.toMatchObject({ ok: true })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0]).toMatchObject({ status: 'PENDING_REVIEW', rejectionReason: null })
  })

  it('lets owners create approved definitions directly and approve drafts', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    const created = await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_MAPPED', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT' } })
    expect(created).toMatchObject({ ok: true, value: { status: 'APPROVED' } })
    expect(await approveClubTrackingDefinition({ db, userId: 'owner-1', definitionId: 'definition-1' })).toMatchObject({ ok: false })
  })

  it('blocks assistants and viewers from drafting', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'ASSISTANT_COACH')
    const result = await createClubTrackingDefinitionDraft({ db, userId: 'assistant-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Lock the six', searchToken, proposalType: 'EVENT' } })
    expect(result).toMatchObject({ ok: false })
  })

  it('enforces event and pattern mapping boundaries', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    await expect(createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_ALIAS', name: 'Break the line', mappedPatternDefinitionId: 'pattern-1', searchToken, proposalType: 'EVENT' } })).resolves.toMatchObject({ ok: false })
    await expect(createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'PATTERN_ALIAS', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'PATTERN' } })).resolves.toMatchObject({ ok: false })
    await expect(createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT' } })).resolves.toMatchObject({ ok: false })
  })

  it('blocks exact global and club duplicates', async () => {
    const db = createDb()
    const state = (db as { state: { globalEventDuplicate: unknown; clubDuplicate: unknown } }).state
    state.globalEventDuplicate = { id: 'event-2', name: 'Break the line', normalizedName: 'break line the' }
    const searchToken = await tokenFor(db)
    const globalResult = await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Break the line', searchToken, proposalType: 'EVENT' } })
    expect(globalResult).toMatchObject({ ok: false })
    state.globalEventDuplicate = null
    state.clubDuplicate = { id: 'definition-x', name: 'Break the line', kind: 'EVENT_CUSTOM' }
    await expect(createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Break the line', searchToken, proposalType: 'EVENT' } })).resolves.toMatchObject({ ok: false })
  })

  it('returns warnings for pattern-like event proposals', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'OWNER', 'Regain and progress into final third')
    const result = await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Regain and progress into final third', searchToken, proposalType: 'EVENT' } })
    expect(result).toMatchObject({ ok: false, fieldErrors: { warnings: expect.any(Array) } })
  })

  it('separates club and standard mapping approval', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    await expect(createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_MAPPED', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT' } })).resolves.toMatchObject({ ok: true })
    await proposeClubTrackingDefinitionMapping({ db, userId: 'owner-1', definitionId: 'definition-1', mappedEventDefinitionId: 'event-1' })
    const before = await getClubTrackingReportingIdentity({ db, clubTrackingDefinitionId: 'definition-1' })
    expect(before).toMatchObject({ ok: true, value: { contributesToStandardReporting: false, benchmarkEligible: false } })
    await expect(approveStandardMapping({ db, actorEmail: 'coach@example.com', definitionId: 'definition-1' })).resolves.toMatchObject({ ok: false })
    await expect(approveStandardMapping({ db, actorEmail: 'admin@example.com', definitionId: 'definition-1' })).resolves.toMatchObject({ ok: true })
    const after = await getClubTrackingReportingIdentity({ db, clubTrackingDefinitionId: 'definition-1' })
    expect(after).toMatchObject({ ok: true, value: { contributesToStandardReporting: true, benchmarkEligible: true } })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].mappingRevision).toBeGreaterThan(1)
  })

  it('production standard approval records reviewer and timestamp', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_MAPPED', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT', scopeType: 'TEAM', targetContext: 'WHOLE_TEAM', phase: 'IN_POSSESSION', focusArea: 'PASSING' } })
    const result = await approveClubTrackingStandardMapping({ db, actorEmail: 'admin@example.com', actorUserId: 'admin-1', definitionId: 'definition-1', expectedMappingRevision: 1, expectedMappingStatus: 'CLUB_APPROVED' })
    expect(result).toMatchObject({ ok: true, value: { contributesToStandardReporting: true } })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0]).toMatchObject({ mappingStatus: 'STANDARD_APPROVED', standardMappingReviewedByUserId: 'admin-1', standardMappingRejectionReason: null, standardMappingRejectionCategory: null })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0].standardMappingReviewedAt).toBeInstanceOf(Date)
  })

  it('production standard rejection requires category and reason', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_MAPPED', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT', scopeType: 'TEAM', targetContext: 'WHOLE_TEAM', phase: 'IN_POSSESSION', focusArea: 'PASSING' } })
    await expect(rejectClubTrackingStandardMapping({ db, actorEmail: 'admin@example.com', actorUserId: 'admin-1', definitionId: 'definition-1', expectedMappingRevision: 1, expectedMappingStatus: 'CLUB_APPROVED', reason: 'Too broad.' })).resolves.toMatchObject({ ok: false, code: 'categoryRequired' })
    await expect(rejectClubTrackingStandardMapping({ db, actorEmail: 'admin@example.com', actorUserId: 'admin-1', definitionId: 'definition-1', expectedMappingRevision: 1, expectedMappingStatus: 'CLUB_APPROVED', category: 'NOT_EQUIVALENT', reason: '' })).resolves.toMatchObject({ ok: false, code: 'reasonRequired' })
    await expect(rejectClubTrackingStandardMapping({ db, actorEmail: 'admin@example.com', actorUserId: 'admin-1', definitionId: 'definition-1', expectedMappingRevision: 1, expectedMappingStatus: 'CLUB_APPROVED', category: 'NOT_EQUIVALENT', reason: 'Too broad.' })).resolves.toMatchObject({ ok: true })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0]).toMatchObject({ mappingStatus: 'REJECTED', standardMappingReviewedByUserId: 'admin-1', standardMappingRejectionCategory: 'NOT_EQUIVALENT', standardMappingRejectionReason: 'Too broad.', status: 'APPROVED' })
  })

  it('rejects stale mapping review submissions', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_MAPPED', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT', scopeType: 'TEAM', targetContext: 'WHOLE_TEAM', phase: 'IN_POSSESSION', focusArea: 'PASSING' } })
    await expect(approveClubTrackingStandardMapping({ db, actorEmail: 'admin@example.com', actorUserId: 'admin-1', definitionId: 'definition-1', expectedMappingRevision: 99, expectedMappingStatus: 'CLUB_APPROVED' })).resolves.toMatchObject({ ok: false, code: 'staleRevision' })
    await expect(approveClubTrackingStandardMapping({ db, actorEmail: 'admin@example.com', actorUserId: 'admin-1', definitionId: 'definition-1', expectedMappingRevision: 1, expectedMappingStatus: 'PROPOSED' })).resolves.toMatchObject({ ok: false, code: 'notReviewable' })
  })

  it('keeps proposed mappings out of standard reporting but aliases contribute through the standard identity', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db)
    await createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_ALIAS', name: 'Break the line', mappedEventDefinitionId: 'event-1', searchToken, proposalType: 'EVENT', mappingStatus: 'PROPOSED' } })
    const identity = await getClubTrackingReportingIdentity({ db, clubTrackingDefinitionId: 'definition-1' })
    expect(identity).toMatchObject({ ok: true, value: { identityType: 'CLUB_ALIAS', contributesToStandardReporting: true, contributesToClubReporting: true, benchmarkEligible: true } })
  })

  it('controls local Match Day selection with standard rejection category', () => {
    const base = { kind: 'EVENT_MAPPED' as const, status: 'APPROVED' as const, active: true, retiredAt: null, mappingStatus: 'REJECTED' as const }
    expect(getClubDefinitionLocalSelectionEligibility({ ...base, standardMappingRejectionCategory: 'NOT_EQUIVALENT' })).toMatchObject({ selectable: true })
    expect(getClubDefinitionLocalSelectionEligibility({ ...base, standardMappingRejectionCategory: 'BETTER_STANDARD_EXISTS' })).toMatchObject({ selectable: true })
    expect(getClubDefinitionLocalSelectionEligibility({ ...base, standardMappingRejectionCategory: 'EVENT_PATTERN_MISMATCH' })).toMatchObject({ selectable: false })
    expect(getClubDefinitionLocalSelectionEligibility({ ...base, standardMappingRejectionCategory: 'OUTCOME_MISMATCH' })).toMatchObject({ selectable: false })
    expect(getClubDefinitionLocalSelectionEligibility({ ...base, active: false, standardMappingRejectionCategory: 'NOT_EQUIVALENT' })).toMatchObject({ selectable: false })
  })

  it('classifies standard reporting eligibility for club observations', () => {
    expect(observationContributesToStandardReporting({ clubTrackingDefinitionId: null, eventDefinitionId: 'event-1' })).toBe(true)
    expect(observationContributesToStandardReporting({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_ALIAS', mappingStatusAtRecording: 'CLUB_APPROVED', eventDefinitionId: 'event-1' })).toBe(true)
    expect(observationContributesToStandardReporting({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_MAPPED', mappingStatusAtRecording: 'STANDARD_APPROVED', eventDefinitionId: 'event-1' })).toBe(true)
    expect(observationContributesToStandardReporting({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_MAPPED', mappingStatusAtRecording: 'CLUB_APPROVED', eventDefinitionId: null })).toBe(false)
    expect(observationContributesToStandardReporting({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'PATTERN_MAPPED', mappingStatusAtRecording: 'REJECTED', patternId: 'pattern-1' })).toBe(false)
    expect(observationContributesToStandardReporting({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_CUSTOM', mappingStatusAtRecording: 'NONE' })).toBe(false)
  })

  it('retires and restores definitions while excluding retired rows from active lists', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'OWNER', 'Lock the six')
    await expect(createClubTrackingDefinitionDraft({ db, userId: 'owner-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Lock the six', searchToken, proposalType: 'EVENT' } })).resolves.toMatchObject({ ok: true })
    await expect(retireClubTrackingDefinition({ db, userId: 'owner-1', definitionId: 'definition-1' })).resolves.toMatchObject({ ok: true })
    expect((db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions[0]).toMatchObject({ status: 'RETIRED', active: false })
    await expect(restoreClubTrackingDefinition({ db, userId: 'owner-1', definitionId: 'definition-1' })).resolves.toMatchObject({ ok: true })
  })

  it('blocks deletion for used definitions', async () => {
    const db = createDb()
    const searchToken = await tokenFor(db, 'OWNER', 'Lock the six')
    await createClubTrackingDefinitionDraft({ db, userId: 'coach-1', input: { clubId: 'club-1', kind: 'EVENT_CUSTOM', name: 'Lock the six', searchToken, proposalType: 'EVENT' } })
    ;(db as { state: { usage: number } }).state.usage = 1
    await expect(deleteUnusedClubTrackingDefinitionDraft({ db, userId: 'coach-1', definitionId: 'definition-1' })).resolves.toMatchObject({ ok: false })
  })

  it('treats existing definitions without visibility fields as club-wide', () => {
    expect(isClubTrackingDefinitionVisibleToTeam({ clubId: 'club-1' }, { id: 'team-1', clubId: 'club-1' })).toBe(true)
    expect(isClubTrackingDefinitionVisibleToTeam({ clubId: 'club-1' }, { id: 'team-x', clubId: 'club-x' })).toBe(false)
  })

  it('validates TEAM and CLUB visibility invariants', () => {
    expect(validateClubTrackingDefinitionVisibility({ clubId: 'club-1', visibilityScope: 'TEAM', teamId: null }, null)).toMatchObject({ ok: false })
    expect(validateClubTrackingDefinitionVisibility({ clubId: 'club-1', visibilityScope: 'CLUB', teamId: 'team-1' }, { id: 'team-1', clubId: 'club-1' })).toMatchObject({ ok: false })
    expect(validateClubTrackingDefinitionVisibility({ clubId: 'club-1', visibilityScope: 'TEAM', teamId: 'team-x' }, { id: 'team-x', clubId: 'club-x' })).toMatchObject({ ok: false })
    expect(validateClubTrackingDefinitionVisibility({ clubId: 'club-1', visibilityScope: 'TEAM', teamId: 'team-1' }, { id: 'team-1', clubId: 'club-1' })).toMatchObject({ ok: true })
    expect(validateClubTrackingDefinitionVisibility({ clubId: 'club-1', visibilityScope: 'CLUB', teamId: null }, null)).toMatchObject({ ok: true })
  })

  it('filters selectable custom observations by visibility, club and active state', async () => {
    const db = createDb()
    const state = (db as { state: { definitions: Array<Record<string, unknown>> } }).state
    state.definitions.push(
      { id: 'club-wide', clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, name: 'Club custom' },
      { id: 'team-private', clubId: 'club-1', teamId: 'team-1', visibilityScope: 'TEAM', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, name: 'Team custom' },
      { id: 'other-team', clubId: 'club-1', teamId: 'team-2', visibilityScope: 'TEAM', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, name: 'Other team custom' },
      { id: 'other-club', clubId: 'club-x', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, name: 'Other club custom' },
      { id: 'retired', clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', status: 'RETIRED', active: false, retiredAt: new Date('2026-01-01'), name: 'Retired custom' },
      { id: 'mapped', clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_MAPPED', status: 'APPROVED', active: true, retiredAt: null, name: 'Mapped event' }
    )
    const result = await getActiveSelectableCustomObservationsForTeam({ db, userId: 'coach-1', teamId: 'team-1' })
    expect(result).toMatchObject({ ok: true })
    expect(result.ok ? result.value.map((definition) => definition.id).sort() : []).toEqual(['club-wide', 'team-private'])
  })

  it('rejects custom selections from another team, another club, inactive or retired definitions', async () => {
    const db = createDb()
    const state = (db as { state: { definitions: Array<Record<string, unknown>> } }).state
    state.definitions.push(
      { id: 'valid', clubId: 'club-1', teamId: 'team-1', visibilityScope: 'TEAM', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'NONE' },
      { id: 'other-team', clubId: 'club-1', teamId: 'team-2', visibilityScope: 'TEAM', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'NONE' },
      { id: 'other-club', clubId: 'club-x', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null, mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'NONE' },
      { id: 'inactive', clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: false, retiredAt: null, mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'NONE' },
      { id: 'retired', clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', status: 'RETIRED', active: false, retiredAt: new Date('2026-01-01'), mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'NONE' }
    )
    await expect(validateCustomObservationForNewMatchSelection({ db, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionId: 'valid' })).resolves.toMatchObject({ ok: true })
    await expect(validateCustomObservationForNewMatchSelection({ db, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionId: 'other-team' })).resolves.toMatchObject({ ok: false })
    await expect(validateCustomObservationForNewMatchSelection({ db, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionId: 'other-club' })).resolves.toMatchObject({ ok: false })
    await expect(validateCustomObservationForNewMatchSelection({ db, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionId: 'inactive' })).resolves.toMatchObject({ ok: false })
    await expect(validateCustomObservationForNewMatchSelection({ db, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionId: 'retired' })).resolves.toMatchObject({ ok: false })
  })

  it('loads already selected retired definitions by Match Day identity', async () => {
    const db = createDb()
    ;(db as { state: { definitions: Array<Record<string, unknown>> } }).state.definitions.push({ id: 'retired', status: 'RETIRED', active: false, retiredAt: new Date('2026-01-01') })
    await expect(getSelectedClubTrackingDefinitionForMatchDay({ db, matchDayId: 'match-1', clubTrackingDefinitionId: 'retired' })).resolves.toMatchObject({ id: 'retired' })
  })

  it('identifies same-scope duplicates without blocking other teams', async () => {
    const db = createDb()
    const state = (db as { state: { definitions: Array<Record<string, unknown>> } }).state
    state.definitions.push(
      { id: 'team-duplicate', clubId: 'club-1', teamId: 'team-1', visibilityScope: 'TEAM', kind: 'EVENT_CUSTOM', normalizedName: 'pres won', name: 'Press won' },
      { id: 'other-team-same-name', clubId: 'club-1', teamId: 'team-2', visibilityScope: 'TEAM', kind: 'EVENT_CUSTOM', normalizedName: 'pres won', name: 'Press won' },
      { id: 'club-duplicate', clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', kind: 'EVENT_CUSTOM', normalizedName: 'counter pres', name: 'Counter press' }
    )
    await expect(findClubTrackingDefinitionDuplicates({ db, clubId: 'club-1', teamId: 'team-1', visibilityScope: 'TEAM', name: 'Press won' })).resolves.toMatchObject({ exact: [expect.objectContaining({ id: 'team-duplicate' })] })
    await expect(findClubTrackingDefinitionDuplicates({ db, clubId: 'club-1', teamId: 'team-2', visibilityScope: 'TEAM', name: 'Press won' })).resolves.toMatchObject({ exact: [expect.objectContaining({ id: 'other-team-same-name' })] })
    await expect(findClubTrackingDefinitionDuplicates({ db, clubId: 'club-1', teamId: null, visibilityScope: 'CLUB', name: 'Counter press' })).resolves.toMatchObject({ exact: [expect.objectContaining({ id: 'club-duplicate' })] })
  })

  it('represents classic total and custom selection limits', () => {
    expect(MAX_CLASSIC_CUSTOM_OBSERVATIONS).toBe(2)
    expect(validateClassicObservationSelectionCounts({ eventDefinitionIds: ['event-1', 'event-2', 'event-3', 'event-4', 'event-5', 'event-6'], clubTrackingDefinitionIds: ['custom-1', 'custom-2'] })).toMatchObject({ ok: true })
    expect(validateClassicObservationSelectionCounts({ eventDefinitionIds: ['event-1', 'event-2', 'event-3', 'event-4', 'event-5', 'event-6', 'event-7'], clubTrackingDefinitionIds: ['custom-1', 'custom-2'] })).toMatchObject({ ok: false })
    expect(validateClassicObservationSelectionCounts({ eventDefinitionIds: ['event-1'], clubTrackingDefinitionIds: ['custom-1', 'custom-2', 'custom-3'] })).toMatchObject({ ok: false })
  })

  it('validates MatchDayEventType legacy, standard and future custom row shapes', () => {
    expect(validateMatchDayEventTypeIdentityShape({ eventDefinitionId: 'event-1', clubTrackingDefinitionId: null, eventType: 'PASS_COMPLETE' })).toMatchObject({ ok: true })
    expect(validateMatchDayEventTypeIdentityShape({ eventDefinitionId: null, clubTrackingDefinitionId: null, eventType: 'PASS_COMPLETE' })).toMatchObject({ ok: true })
    expect(validateMatchDayEventTypeIdentityShape({ eventDefinitionId: null, clubTrackingDefinitionId: 'custom-1', eventType: null })).toMatchObject({ ok: true })
    expect(validateMatchDayEventTypeIdentityShape({ eventDefinitionId: 'event-1', clubTrackingDefinitionId: 'custom-1', eventType: null })).toMatchObject({ ok: false })
    expect(validateMatchDayEventTypeIdentityShape({ eventDefinitionId: null, clubTrackingDefinitionId: 'custom-1', eventType: 'PASS_COMPLETE' })).toMatchObject({ ok: false })
  })

  it('rejects pure custom selections that claim standard mapping identity', () => {
    expect(validatePureCustomSelectionIdentity({ kind: 'EVENT_CUSTOM', mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'NONE' })).toMatchObject({ ok: true })
    expect(validatePureCustomSelectionIdentity({ kind: 'EVENT_CUSTOM', mappedEventDefinitionId: 'event-1', mappedPatternDefinitionId: null, mappingStatus: 'NONE' })).toMatchObject({ ok: false })
    expect(validatePureCustomSelectionIdentity({ kind: 'EVENT_CUSTOM', mappedEventDefinitionId: null, mappedPatternDefinitionId: null, mappingStatus: 'PROPOSED' })).toMatchObject({ ok: false })
    expect(validatePureCustomSelectionIdentity({ kind: 'EVENT_MAPPED', mappedEventDefinitionId: 'event-1', mappedPatternDefinitionId: null, mappingStatus: 'CLUB_APPROVED' })).toMatchObject({ ok: false })
  })
})
