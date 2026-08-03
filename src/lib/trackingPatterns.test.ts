import { describe, expect, it, vi } from 'vitest'

import { createPatternObservation, recordAssignedClubPattern, reviewPatternObservation, undoPendingPatternObservation } from '@/lib/trackingPatterns'

vi.mock('@/lib/permissions', () => ({
  canManageMatchDay: vi.fn(async () => true),
  canRunMatchDay: vi.fn(async () => true),
}))

const match = {
  id: 'match-1',
  ownScore: 1,
  oppositionScore: 0,
  firstHalfStartedAt: new Date(Date.now() - 60_000),
  firstHalfEndedAt: null,
  secondHalfStartedAt: null,
  secondHalfEndedAt: null,
  completedAt: null,
  status: 'IN_PROGRESS' as const,
}

function createDb(overrides: Record<string, unknown> = {}) {
  const db = {
    matchContributorAssignment: {
      findUnique: async () => ({
        id: 'assignment-1',
        assignedUserId: 'contributor-1',
        status: 'IN_PROGRESS',
        trackingTaskId: 'task-1',
        trackingTask: {
          id: 'task-1',
          matchDayId: 'match-1',
          scopeType: 'PLAYER',
          playerId: 'player-1',
          unitKey: null,
          status: 'READY',
          matchDay: match,
          player: { id: 'player-1', preferredPosition: 'Centre-forward' },
          patterns: [{
            patternId: 'pattern-1',
            pattern: {
              id: 'pattern-1',
              active: true,
              requiresLocation: true,
              contexts: [{ scopeType: 'PLAYER', targetContext: null }],
              outcomes: [{ id: 'outcome-1' }],
            },
          }],
        },
      }),
    },
    matchPlayerStint: { findFirst: async () => ({ id: 'stint-1' }) },
    submittedTrackingPatternObservation: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `submitted:${data.patternId}` }),
      findFirst: async ({ where }: { where?: { createdAt?: unknown } } = {}) => where?.createdAt ? null : ({ id: 'submitted-1', status: 'PENDING', assignment: { status: 'IN_PROGRESS' } }),
      findUnique: async () => ({
        id: 'submitted-1',
        matchDayId: 'match-1',
        trackingTaskId: 'task-1',
        assignmentId: 'assignment-1',
        submittedByUserId: 'contributor-1',
        playerId: 'player-1',
        patternId: 'pattern-1',
        outcomeId: 'outcome-1',
        clubTrackingDefinitionId: 'club-pattern-1',
        standardPatternDefinitionIdAtRecording: 'pattern-1',
        clubMappingRevisionAtRecording: 3,
        clubMappingStatusAtRecording: 'CLUB_APPROVED',
        half: 'FIRST_HALF',
        matchSecond: 55,
        ownScoreAtTime: 1,
        oppositionScoreAtTime: 0,
        x: 42,
        y: 21,
        note: 'Good set',
        status: 'PENDING',
        matchDay: match,
      }),
      updateMany: async () => ({ count: 1 }),
      delete: async () => ({ id: 'submitted-1' }),
    },
    matchTrackingPatternObservation: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `official:${data.submittedObservationId}` }),
    },
    matchEvent: { create: vi.fn() },
    $transaction: async (input: unknown) => (input as (tx: unknown) => unknown)(db),
    ...overrides,
  }
  return db as never
}

function createClubPatternDb(overrides: Record<string, unknown> = {}) {
  const assignment = {
    id: 'assignment-1', assignedUserId: 'contributor-1', status: 'IN_PROGRESS', trackingTaskId: 'task-1',
    trackingTask: {
      id: 'task-1', matchDayId: 'match-1', scopeType: 'PLAYER', playerId: 'player-1', unitKey: null, status: 'READY', matchDay: { ...match, team: { clubId: 'club-1' } },
      clubDefinitions: [{
        id: 'task-club-1', selectedKind: 'PATTERN_MAPPED', standardPatternDefinitionIdAtSelection: 'pattern-1',
        clubTrackingDefinition: { id: 'club-pattern-1', clubId: 'club-1', kind: 'PATTERN_MAPPED', status: 'APPROVED', active: true, retiredAt: null, name: 'Bounce and break', requiresLocation: false, mappedPatternDefinitionId: 'pattern-1', mappingStatus: 'CLUB_APPROVED', mappingRevision: 3, standardMappingRejectionCategory: null, scopeType: 'PLAYER', targetContext: null, phase: null, focusArea: null, mappedPatternDefinition: { id: 'pattern-1', active: true, requiresLocation: true, contexts: [{ scopeType: 'PLAYER', targetContext: null }], outcomes: [{ id: 'outcome-1' }] } },
      }],
    },
  }
  const db = {
    matchContributorAssignment: { findUnique: async () => assignment },
    matchPlayerStint: { findFirst: async () => ({ id: 'stint-1' }) },
    submittedTrackingPatternObservation: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `submitted:${data.clubTrackingDefinitionId}` }) },
    $transaction: async (input: unknown) => (input as (tx: unknown) => unknown)(db),
    ...overrides,
  }
  return db as never
}

describe('tracking pattern observations', () => {
  it('creates a valid PLAYER pattern observation with coordinates', async () => {
    const result = await createPatternObservation({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'contributor-1', patternId: 'pattern-1', outcomeId: 'outcome-1', playerId: 'player-1', x: 42, y: 21 })

    expect(result).toMatchObject({ ok: true, value: { id: 'submitted:pattern-1' } })
  })

  it('rejects missing required location', async () => {
    const result = await createPatternObservation({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'contributor-1', patternId: 'pattern-1', outcomeId: 'outcome-1', playerId: 'player-1' })

    expect(result).toMatchObject({ ok: false, reason: 'This pattern requires pitch coordinates.' })
  })

  it('stores null player for UNIT pattern observations', async () => {
    let createdData = {} as Record<string, unknown>
    const db = createDb({
      matchContributorAssignment: {
        findUnique: async () => ({
          id: 'assignment-1', assignedUserId: 'contributor-1', status: 'IN_PROGRESS', trackingTaskId: 'task-1',
          trackingTask: { id: 'task-1', matchDayId: 'match-1', scopeType: 'UNIT', playerId: null, unitKey: 'DEFENSIVE_UNIT', status: 'READY', matchDay: match, player: null, patterns: [{ patternId: 'pattern-1', pattern: { id: 'pattern-1', active: true, requiresLocation: false, contexts: [{ scopeType: 'UNIT', targetContext: 'DEFENSIVE_UNIT' }], outcomes: [{ id: 'outcome-1' }] } }] },
        }),
      },
      submittedTrackingPatternObservation: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: 'submitted-1' } } },
    })

    const result = await createPatternObservation({ db, assignmentId: 'assignment-1', actorUserId: 'contributor-1', patternId: 'pattern-1', outcomeId: 'outcome-1', playerId: 'player-1' })

    expect(result.ok).toBe(true)
    expect(createdData.playerId).toBeNull()
  })

  it('accepts a pending pattern observation without creating step events', async () => {
    let createdData = {} as Record<string, unknown>
    const db = createDb({ matchTrackingPatternObservation: { findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: `official:${data.submittedObservationId}` } } } })
    const result = await reviewPatternObservation({ db, actorUserId: 'coach-1', observationId: 'submitted-1', decision: 'ACCEPTED' })

    expect(result).toMatchObject({ ok: true, value: { officialObservationId: 'official:submitted-1' } })
    expect(createdData).toMatchObject({ clubTrackingDefinitionId: 'club-pattern-1', standardPatternDefinitionIdAtRecording: 'pattern-1', clubMappingRevisionAtRecording: 3, clubMappingStatusAtRecording: 'CLUB_APPROVED' })
    expect((db as { matchEvent: { create: ReturnType<typeof vi.fn> } }).matchEvent.create).not.toHaveBeenCalled()
  })

  it('returns an existing official pattern observation on repeated acceptance', async () => {
    const db = createDb({ matchTrackingPatternObservation: { findUnique: async () => ({ id: 'official-existing' }), create: async () => { throw new Error('should not create') } } })
    await expect(reviewPatternObservation({ db, actorUserId: 'coach-1', observationId: 'submitted-1', decision: 'ACCEPTED' })).resolves.toMatchObject({ ok: true, value: { officialObservationId: 'official-existing' } })
  })

  it('does not create an official observation when ignored', async () => {
    const officialCreate = vi.fn()
    const result = await reviewPatternObservation({ db: createDb({ matchTrackingPatternObservation: { findUnique: async () => null, create: officialCreate } }), actorUserId: 'coach-1', observationId: 'submitted-1', decision: 'IGNORED' })

    expect(result).toMatchObject({ ok: true, value: { officialObservationId: null } })
    expect(officialCreate).not.toHaveBeenCalled()
  })

  it('prevents contributor self-review and allows pending undo', async () => {
    await expect(reviewPatternObservation({ db: createDb(), actorUserId: 'contributor-1', observationId: 'submitted-1', decision: 'ACCEPTED' })).resolves.toMatchObject({ ok: false })
    await expect(undoPendingPatternObservation({ db: createDb(), actorUserId: 'contributor-1', assignmentId: 'assignment-1', observationId: 'submitted-1' })).resolves.toMatchObject({ ok: true })
  })

  it('records club mapped pattern provenance while retaining pattern id for outcomes', async () => {
    let createdData = {} as Record<string, unknown>
    const result = await recordAssignedClubPattern({ db: createClubPatternDb({ submittedTrackingPatternObservation: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: 'submitted-1' } } } }), assignmentId: 'assignment-1', actorUserId: 'contributor-1', taskClubDefinitionId: 'task-club-1', outcomeId: 'outcome-1', playerId: 'player-1', x: 42, y: 21 })

    expect(result).toMatchObject({ ok: true, observationId: 'submitted-1' })
    expect(createdData).toMatchObject({ patternId: 'pattern-1', outcomeId: 'outcome-1', clubTrackingDefinitionId: 'club-pattern-1', standardPatternDefinitionIdAtRecording: 'pattern-1', clubMappingRevisionAtRecording: 3, clubMappingStatusAtRecording: 'CLUB_APPROVED' })
  })

  it('validates club pattern location, outcome and stale target', async () => {
    await expect(recordAssignedClubPattern({ db: createClubPatternDb(), assignmentId: 'assignment-1', actorUserId: 'contributor-1', taskClubDefinitionId: 'task-club-1', outcomeId: 'outcome-1', playerId: 'player-1' })).resolves.toMatchObject({ ok: false, reason: 'locationRequired' })
    await expect(recordAssignedClubPattern({ db: createClubPatternDb(), assignmentId: 'assignment-1', actorUserId: 'contributor-1', taskClubDefinitionId: 'task-club-1', outcomeId: 'wrong-outcome', playerId: 'player-1', x: 1, y: 1 })).resolves.toMatchObject({ ok: false, reason: 'outcomeInvalid' })
    const stale = { findUnique: async () => ({ id: 'assignment-1', assignedUserId: 'contributor-1', status: 'IN_PROGRESS', trackingTaskId: 'task-1', trackingTask: { id: 'task-1', matchDayId: 'match-1', scopeType: 'PLAYER', playerId: 'player-1', unitKey: null, status: 'READY', matchDay: { ...match, team: { clubId: 'club-1' } }, clubDefinitions: [{ id: 'task-club-1', selectedKind: 'PATTERN_MAPPED', standardPatternDefinitionIdAtSelection: 'old-pattern', clubTrackingDefinition: { id: 'club-pattern-1', clubId: 'club-1', kind: 'PATTERN_MAPPED', status: 'APPROVED', active: true, retiredAt: null, requiresLocation: false, mappedPatternDefinitionId: 'pattern-1', mappingStatus: 'CLUB_APPROVED', mappingRevision: 1, standardMappingRejectionCategory: null, scopeType: 'PLAYER', targetContext: null, phase: null, focusArea: null, mappedPatternDefinition: { id: 'pattern-1', active: true, requiresLocation: false, contexts: [{ scopeType: 'PLAYER', targetContext: null }], outcomes: [{ id: 'outcome-1' }] } } }] } }) }
    await expect(recordAssignedClubPattern({ db: createClubPatternDb({ matchContributorAssignment: stale }), assignmentId: 'assignment-1', actorUserId: 'contributor-1', taskClubDefinitionId: 'task-club-1', outcomeId: 'outcome-1', playerId: 'player-1', x: 1, y: 1 })).resolves.toMatchObject({ ok: false, reason: 'taskDefinitionStale' })
  })
})
