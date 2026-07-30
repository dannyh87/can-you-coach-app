import { describe, expect, it } from 'vitest'

import {
  claimGroupOffer,
  copyMatchTrackingTask,
  createDirectAssignment,
  createGroupOffer,
  createSelfAssignment,
  declineDirectAssignment,
  declineGroupOffer,
  markContributorAssignmentSubmitted,
  markMatchTrackingTaskReady,
  setMatchTrackingTaskEvents,
  startContributorAssignment,
  validateAssignmentTransition,
  validateTrackingTaskScope,
} from '@/lib/matchTrackingAssignments'

const baseTask = {
  id: 'task-1',
  matchDayId: 'match-1',
  createdByUserId: 'coach-1',
  scopeType: 'PLAYER' as const,
  playerId: 'player-1',
  unitKey: null,
  unitLabel: null,
  title: 'CF link play',
  instructions: 'Watch link play.',
  sourceTaskId: null,
  status: 'READY' as const,
  events: [{ id: 'task-event-1' }],
}

function createDb(overrides: Record<string, unknown> = {}) {
  const db = {
    matchDay: {
      findUnique: async () => ({
        id: 'match-1',
        teamId: 'team-1',
        team: {
          clubId: 'club-1',
          club: {
            memberships: [
              { userId: 'coach-1', role: 'COACH', teamAssignments: [{ teamId: 'team-1' }], user: { id: 'coach-1' } },
              { userId: 'assistant-1', role: 'ASSISTANT_COACH', teamAssignments: [{ teamId: 'team-1' }], user: { id: 'assistant-1' } },
              { userId: 'viewer-1', role: 'VIEWER', teamAssignments: [{ teamId: 'team-1' }], user: { id: 'viewer-1' } },
            ],
            spectators: [
              { userId: 'parent-1', playerId: 'player-1', user: { id: 'parent-1' }, player: { id: 'player-1', teamId: 'team-1' } },
              { userId: 'parent-2', playerId: 'player-2', user: { id: 'parent-2' }, player: { id: 'player-2', teamId: 'team-1' } },
            ],
          },
        },
      }),
    },
    matchDayPlayer: {
      findFirst: async ({ where }: { where: { playerId?: string } }) => where.playerId === 'player-missing' ? null : { id: 'match-player-1' },
    },
    matchTrackingTask: {
      findUnique: async () => baseTask,
      create: async () => ({ id: 'created-task' }),
      update: async () => ({ id: 'task-1' }),
    },
    matchTrackingTaskEvent: {
      count: async () => 1,
      deleteMany: async () => ({ count: 1 }),
      create: async () => ({ id: 'task-event-new' }),
      createMany: async () => ({ count: 1 }),
    },
    matchDayEventType: {
      findMany: async () => [{ id: 'selected-1', matchDayId: 'match-1', eventDefinitionId: 'definition-1', eventType: 'GOAL' }],
    },
    matchContributorAssignment: {
      findFirst: async () => null,
      findUnique: async () => ({ id: 'assignment-1', trackingTaskId: 'task-1', assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId: 'parent-1', trackingTask: baseTask }),
      create: async () => ({ id: 'assignment-1' }),
      update: async () => ({ id: 'assignment-1' }),
      updateMany: async () => ({ count: 1 }),
    },
    matchContributorAssignmentRecipient: {
      findFirst: async () => ({ id: 'recipient-1' }),
      createMany: async () => ({ count: 2 }),
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input)
      return (input as (tx: unknown) => unknown)(db)
    },
    ...overrides,
  }
  return db as never
}

describe('tracking task validation', () => {
  it('allows incomplete draft player tasks but not ready player tasks', () => {
    expect(validateTrackingTaskScope({ scopeType: 'PLAYER', playerId: null }).ok).toBe(true)
    expect(validateTrackingTaskScope({ scopeType: 'PLAYER', playerId: null }, { requireCompletePlayer: true }).ok).toBe(false)
  })

  it('rejects invalid cross-scope fields', () => {
    expect(validateTrackingTaskScope({ scopeType: 'PLAYER', playerId: 'p1', unitKey: 'def', unitLabel: 'Defence' }).ok).toBe(false)
    expect(validateTrackingTaskScope({ scopeType: 'UNIT', playerId: 'p1', unitKey: 'def', unitLabel: 'Defence' }).ok).toBe(false)
    expect(validateTrackingTaskScope({ scopeType: 'UNIT', unitKey: null, unitLabel: 'Defence' }).ok).toBe(false)
    expect(validateTrackingTaskScope({ scopeType: 'TEAM', playerId: 'p1' }).ok).toBe(false)
  })

  it('rejects task events from another match and duplicate event ids', async () => {
    const duplicate = await setMatchTrackingTaskEvents({ db: createDb(), actorUserId: 'coach-1', trackingTaskId: 'task-1', matchDayEventTypeIds: ['selected-1', 'selected-1'] })
    expect(duplicate.ok).toBe(false)

    const wrongMatch = await setMatchTrackingTaskEvents({
      db: createDb({ matchDayEventType: { findMany: async () => [{ id: 'selected-2', matchDayId: 'other-match' }] } }),
      actorUserId: 'coach-1',
      trackingTaskId: 'task-1',
      matchDayEventTypeIds: ['selected-2'],
    })
    expect(wrongMatch.ok).toBe(false)
  })

  it('requires complete ready-state invariants', async () => {
    const missingPlayer = await markMatchTrackingTaskReady({
      db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, playerId: null }), update: async () => ({}) } }),
      actorUserId: 'coach-1',
      trackingTaskId: 'task-1',
    })
    expect(missingPlayer.ok).toBe(false)
  })
})

describe('assignment transitions and creation', () => {
  it('rejects invalid transitions', () => {
    expect(validateAssignmentTransition({ assignment: { id: 'a1', trackingTaskId: 't1', assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId: 'user-1' }, action: 'start', actorUserId: 'user-1' }).ok).toBe(false)
    expect(validateAssignmentTransition({ assignment: { id: 'a1', trackingTaskId: 't1', assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId: 'user-1' }, action: 'accept', actorUserId: 'other' }).ok).toBe(false)
  })

  it('requires ready tasks before assignment', async () => {
    const result = await createDirectAssignment({ db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, status: 'DRAFT' }) } }), actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-1' })
    expect(result.ok).toBe(false)
  })

  it('creates self and direct assignments only for eligible users', async () => {
    expect((await createSelfAssignment({ db: createDb(), actorUserId: 'coach-1', trackingTaskId: 'task-1' })).ok).toBe(true)
    expect((await createDirectAssignment({ db: createDb(), actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-1' })).ok).toBe(true)
    expect((await createDirectAssignment({ db: createDb(), actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-2' })).ok).toBe(false)
  })

  it('allows accepted assignments to start and submit', async () => {
    const db = createDb({ matchContributorAssignment: { findUnique: async () => ({ id: 'assignment-1', trackingTaskId: 'task-1', assignmentMode: 'DIRECT', status: 'ACCEPTED', assignedUserId: 'parent-1' }), update: async () => ({}) } })
    expect((await startContributorAssignment({ db, assignmentId: 'assignment-1', actorUserId: 'parent-1' })).ok).toBe(true)
    const inProgressDb = createDb({ matchContributorAssignment: { findUnique: async () => ({ id: 'assignment-1', trackingTaskId: 'task-1', assignmentMode: 'DIRECT', status: 'IN_PROGRESS', assignedUserId: 'parent-1' }), update: async () => ({}) } })
    expect((await markContributorAssignmentSubmitted({ db: inProgressDb, assignmentId: 'assignment-1', actorUserId: 'parent-1' })).ok).toBe(true)
  })

  it('lets assigned users decline direct assignments', async () => {
    expect((await declineDirectAssignment({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'parent-1' })).ok).toBe(true)
  })
})

describe('group offers', () => {
  it('creates a group offer for eligible recipients', async () => {
    expect((await createGroupOffer({ db: createDb(), actorUserId: 'coach-1', trackingTaskId: 'task-1', recipientUserIds: ['parent-1', 'assistant-1'] })).ok).toBe(true)
  })

  it('claims group offers atomically and reports conflicts', async () => {
    expect((await claimGroupOffer({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'parent-1' })).ok).toBe(true)
    const conflict = await claimGroupOffer({ db: createDb({ matchContributorAssignment: { updateMany: async () => ({ count: 0 }) } }), assignmentId: 'assignment-1', actorUserId: 'parent-1' })
    expect(conflict.ok).toBe(false)
  })

  it('lets recipients decline without closing the offer for others', async () => {
    expect((await declineGroupOffer({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'parent-1' })).ok).toBe(true)
  })
})

describe('copy tracking task', () => {
  it('copies player tasks as draft requiring player selection when no destination player is supplied', async () => {
    const result = await copyMatchTrackingTask({ db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, events: [{ matchDayEventTypeId: 'selected-1', matchDayEventType: { eventDefinitionId: 'definition-1', eventType: 'GOAL' } }] }), create: async () => ({ id: 'copy-1' }) } }), actorUserId: 'coach-1', sourceTaskId: 'task-1', destinationMatchDayId: 'match-1' })
    expect(result).toMatchObject({ ok: true, value: { requiresPlayerSelection: true } })
  })

  it('reports missing event mappings', async () => {
    const result = await copyMatchTrackingTask({ db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, events: [{ matchDayEventTypeId: 'missing-source', matchDayEventType: { eventDefinitionId: 'missing-definition', eventType: null } }] }) }, matchDayEventType: { findMany: async () => [] } }), actorUserId: 'coach-1', sourceTaskId: 'task-1', destinationMatchDayId: 'match-1' })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ ok: false, missingEventIds: ['missing-source'] })
  })
})
