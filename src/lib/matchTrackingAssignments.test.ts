import { afterEach, describe, expect, it } from 'vitest'

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
  topicId: null,
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
    eventTopic: { findFirst: async () => ({ id: 'topic-1' }) },
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

  it('returns an existing identical direct assignment and conflicts on a different assignee', async () => {
    const existing = { id: 'assignment-1', assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId: 'parent-1', recipients: [] }
    const identical = await createDirectAssignment({ db: createDb({ matchContributorAssignment: { findFirst: async () => existing, findUnique: async () => baseTask, create: async () => { throw new Error('should not create') } } }), actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-1' })
    const conflicting = await createDirectAssignment({ db: createDb({ matchContributorAssignment: { findFirst: async () => existing, findUnique: async () => baseTask, create: async () => { throw new Error('should not create') } } }), actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'assistant-1' })

    expect(identical).toEqual({ ok: true, value: { id: 'assignment-1' } })
    expect(conflicting.ok).toBe(false)
  })

  it('translates unique-index conflicts into existing assignment or friendly conflict', async () => {
    let existing = null as null | { id: string; assignmentMode: 'DIRECT'; status: 'PENDING'; assignedUserId: string; recipients: never[] }
    const db = createDb({ matchContributorAssignment: { findFirst: async () => existing, findUnique: async () => baseTask, create: async () => { existing = { id: 'assignment-1', assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId: 'parent-1', recipients: [] }; throw { code: 'P2002' } } } })
    const identical = await createDirectAssignment({ db, actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-1' })
    existing = { id: 'assignment-2', assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId: 'assistant-1', recipients: [] }
    const conflicting = await createDirectAssignment({ db, actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-1' })

    expect(identical).toEqual({ ok: true, value: { id: 'assignment-1' } })
    expect(conflicting.ok).toBe(false)
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

  it('returns existing identical group offers and conflicts on different recipients', async () => {
    const existing = { id: 'assignment-1', assignmentMode: 'GROUP_OFFER', status: 'OFFERED', assignedUserId: null, recipients: [{ userId: 'parent-1' }, { userId: 'assistant-1' }] }
    const identical = await createGroupOffer({ db: createDb({ matchContributorAssignment: { findFirst: async () => existing, findUnique: async () => baseTask, create: async () => { throw new Error('should not create') } } }), actorUserId: 'coach-1', trackingTaskId: 'task-1', recipientUserIds: ['assistant-1', 'parent-1'] })
    const conflicting = await createGroupOffer({ db: createDb({ matchContributorAssignment: { findFirst: async () => existing, findUnique: async () => baseTask, create: async () => { throw new Error('should not create') } } }), actorUserId: 'coach-1', trackingTaskId: 'task-1', recipientUserIds: ['parent-1'] })

    expect(identical).toEqual({ ok: true, value: { id: 'assignment-1' } })
    expect(conflicting.ok).toBe(false)
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

  it('copies topic references without requiring existing tasks to have topics', async () => {
    const createdData: Array<Record<string, unknown>> = []
    const withTopic = await copyMatchTrackingTask({ db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, topicId: 'topic-1', events: [{ matchDayEventTypeId: 'selected-1', matchDayEventType: { eventDefinitionId: 'definition-1', eventType: 'GOAL' } }] }), create: async ({ data }: { data: Record<string, unknown> }) => { createdData.push(data); return { id: 'copy-1' } } } }), actorUserId: 'coach-1', sourceTaskId: 'task-1', destinationMatchDayId: 'match-1', destinationPlayerId: 'player-1' })
    const withoutTopic = await copyMatchTrackingTask({ db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, topicId: null, events: [{ matchDayEventTypeId: 'selected-1', matchDayEventType: { eventDefinitionId: 'definition-1', eventType: 'GOAL' } }] }), create: async ({ data }: { data: Record<string, unknown> }) => { createdData.push(data); return { id: 'copy-2' } } } }), actorUserId: 'coach-1', sourceTaskId: 'task-1', destinationMatchDayId: 'match-1', destinationPlayerId: 'player-1' })

    expect(withTopic.ok).toBe(true)
    expect(withoutTopic.ok).toBe(true)
    expect(createdData).toEqual(expect.arrayContaining([expect.objectContaining({ topicId: 'topic-1' }), expect.objectContaining({ topicId: null })]))
  })

  it('reports missing event mappings', async () => {
    const result = await copyMatchTrackingTask({ db: createDb({ matchTrackingTask: { findUnique: async () => ({ ...baseTask, events: [{ matchDayEventTypeId: 'missing-source', matchDayEventType: { eventDefinitionId: 'missing-definition', eventType: null } }] }) }, matchDayEventType: { findMany: async () => [] } }), actorUserId: 'coach-1', sourceTaskId: 'task-1', destinationMatchDayId: 'match-1' })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ ok: false, missingEventIds: ['missing-source'] })
  })
})

describe('assignment notification integration', () => {
  const originalFlag = process.env.MATCH_DAY_TRACKING_V2

  function createNotificationDb({ claimCount = 1 } = {}) {
    const notifications: Array<{ userId?: string; type?: string; archived?: boolean }> = []
    const assignmentRecord = {
      id: 'assignment-1',
      trackingTaskId: 'task-1',
      assignmentMode: 'GROUP_OFFER' as 'GROUP_OFFER' | 'DIRECT',
      status: 'OFFERED' as 'OFFERED' | 'PENDING',
      assignedUserId: null as string | null,
      assignedByUserId: 'coach-1',
      assignedUser: null,
      assignedBy: { id: 'coach-1' },
      recipients: [{ userId: 'parent-1', declinedAt: null, closedAt: null }, { userId: 'parent-2', declinedAt: null, closedAt: null }],
      trackingTask: {
        ...baseTask,
        matchDay: { id: 'match-1', teamId: 'team-1', opposition: 'Market Drayton', kickoffAt: new Date('2026-08-01T10:00:00Z'), team: { name: 'Brereton' } },
        player: { firstName: 'Freddie', surname: 'Forward' },
        events: [{ id: 'task-event-1', matchDayEventType: { eventDefinition: null } }],
      },
    }
    const db = createDb({
      matchContributorAssignment: {
        findFirst: async () => null,
        findUnique: async () => assignmentRecord,
        create: async ({ data }: { data: { assignedUserId?: string } }) => {
          assignmentRecord.assignedUserId = data.assignedUserId ?? null
          assignmentRecord.assignmentMode = 'DIRECT'
          assignmentRecord.status = 'PENDING'
          return { id: assignmentRecord.id }
        },
        update: async () => ({ id: assignmentRecord.id }),
        updateMany: async () => ({ count: claimCount }),
      },
      notification: {
        upsert: async ({ create }: { create: { userId: string; type: string } }) => {
          notifications.push(create)
          return { id: `notification-${notifications.length}` }
        },
        updateMany: async () => {
          notifications.push({ archived: true })
          return { count: 1 }
        },
      },
    })
    return { db, notifications }
  }

  afterEach(() => {
    process.env.MATCH_DAY_TRACKING_V2 = originalFlag
  })

  it('notifies a contributor when a direct assignment is created', async () => {
    process.env.MATCH_DAY_TRACKING_V2 = 'true'
    const { db, notifications } = createNotificationDb()
    const result = await createDirectAssignment({ db, actorUserId: 'coach-1', trackingTaskId: 'task-1', assignedUserId: 'parent-1' })

    expect(result.ok).toBe(true)
    expect(notifications).toContainEqual(expect.objectContaining({ userId: 'parent-1', type: 'TRACKING_DIRECT_ASSIGNED' }))
  })

  it('resolves other recipient notifications when a group offer is claimed', async () => {
    process.env.MATCH_DAY_TRACKING_V2 = 'true'
    const { db, notifications } = createNotificationDb()
    const result = await claimGroupOffer({ db, assignmentId: 'assignment-1', actorUserId: 'parent-1' })

    expect(result.ok).toBe(true)
    expect(notifications).toContainEqual(expect.objectContaining({ archived: true }))
    expect(notifications).toContainEqual(expect.objectContaining({ userId: 'coach-1', type: 'TRACKING_OFFER_CLAIMED' }))
    expect(notifications).toContainEqual(expect.objectContaining({ userId: 'parent-2', type: 'TRACKING_OFFER_CLAIMED' }))
  })

  it('does not create claim notifications when a group claim fails', async () => {
    process.env.MATCH_DAY_TRACKING_V2 = 'true'
    const { db, notifications } = createNotificationDb({ claimCount: 0 })
    const result = await claimGroupOffer({ db, assignmentId: 'assignment-1', actorUserId: 'parent-1' })

    expect(result.ok).toBe(false)
    expect(notifications).toEqual([])
  })
})
