import { describe, expect, it, vi } from 'vitest'

import { createPatternObservation, reviewPatternObservation, undoPendingPatternObservation } from '@/lib/trackingPatterns'

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
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `official:${data.submittedObservationId}` }),
    },
    matchEvent: { create: vi.fn() },
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
    const db = createDb()
    const result = await reviewPatternObservation({ db, actorUserId: 'coach-1', observationId: 'submitted-1', decision: 'ACCEPTED' })

    expect(result).toMatchObject({ ok: true, value: { officialObservationId: 'official:submitted-1' } })
    expect((db as { matchEvent: { create: ReturnType<typeof vi.fn> } }).matchEvent.create).not.toHaveBeenCalled()
  })

  it('does not create an official observation when ignored', async () => {
    const officialCreate = vi.fn()
    const result = await reviewPatternObservation({ db: createDb({ matchTrackingPatternObservation: { create: officialCreate } }), actorUserId: 'coach-1', observationId: 'submitted-1', decision: 'IGNORED' })

    expect(result).toMatchObject({ ok: true, value: { officialObservationId: null } })
    expect(officialCreate).not.toHaveBeenCalled()
  })

  it('prevents contributor self-review and allows pending undo', async () => {
    await expect(reviewPatternObservation({ db: createDb(), actorUserId: 'contributor-1', observationId: 'submitted-1', decision: 'ACCEPTED' })).resolves.toMatchObject({ ok: false })
    await expect(undoPendingPatternObservation({ db: createDb(), actorUserId: 'contributor-1', assignmentId: 'assignment-1', observationId: 'submitted-1' })).resolves.toMatchObject({ ok: true })
  })
})
