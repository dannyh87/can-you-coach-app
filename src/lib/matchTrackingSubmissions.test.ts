import { describe, expect, it } from 'vitest'

import { createAssignmentLinkedSubmission, validateAssignmentSubmissionContext } from '@/lib/matchTrackingSubmissions'

const liveMatch = {
  id: 'match-1',
  status: 'IN_PROGRESS',
  firstHalfStartedAt: new Date('2026-07-29T10:00:00.000Z'),
  firstHalfEndedAt: null,
  secondHalfStartedAt: null,
  secondHalfEndedAt: null,
  ownScore: 1,
  oppositionScore: 0,
}

const assignment = {
  id: 'assignment-1',
  assignedUserId: 'user-1',
  status: 'IN_PROGRESS',
  trackingTask: {
    id: 'task-1',
    matchDayId: 'match-1',
    status: 'READY',
    scopeType: 'PLAYER',
    playerId: 'player-1',
    matchDay: liveMatch,
    events: [
      {
        matchDayEventTypeId: 'selected-definition',
        matchDayEventType: {
          id: 'selected-definition',
          matchDayId: 'match-1',
          eventDefinitionId: 'definition-1',
          eventType: 'GOAL',
          eventDefinition: { legacyEventType: 'GOAL', requiresLocation: false },
        },
      },
      {
        matchDayEventTypeId: 'selected-location',
        matchDayEventType: {
          id: 'selected-location',
          matchDayId: 'match-1',
          eventDefinitionId: 'definition-location',
          eventType: null,
          eventDefinition: { legacyEventType: null, requiresLocation: true },
        },
      },
      {
        matchDayEventTypeId: 'selected-legacy',
        matchDayEventType: {
          id: 'selected-legacy',
          matchDayId: 'match-1',
          eventDefinitionId: null,
          eventType: 'ASSIST',
          eventDefinition: null,
        },
      },
    ],
  },
}

function createDb(overrides: Record<string, unknown> = {}) {
  const db = {
    matchContributorAssignment: { findUnique: async () => assignment },
    matchPlayerStint: { findFirst: async () => ({ id: 'stint-1' }) },
    submittedMatchEvent: {
      findFirst: async () => null,
      create: async () => ({ id: 'submission-1' }),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    ...overrides,
  }
  return db as never
}

describe('assignment-aware submission validation', () => {
  it('allows assigned contributor to record a task event', async () => {
    const result = await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-definition' })
    expect(result).toMatchObject({ ok: true, value: { eventDefinitionId: 'definition-1', eventType: 'GOAL' } })
  })

  it('rejects another user and events outside the task', async () => {
    expect((await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'other-user', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-definition' })).ok).toBe(false)
    expect((await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'outside-task' })).ok).toBe(false)
  })

  it('rejects cancelled and submitted assignments', async () => {
    expect((await validateAssignmentSubmissionContext({ db: createDb({ matchContributorAssignment: { findUnique: async () => ({ ...assignment, status: 'CANCELLED' }) } }), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-definition' })).ok).toBe(false)
    expect((await validateAssignmentSubmissionContext({ db: createDb({ matchContributorAssignment: { findUnique: async () => ({ ...assignment, status: 'SUBMITTED' }) } }), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-definition' })).ok).toBe(false)
  })

  it('requires coordinates for location-required task events', async () => {
    expect((await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-location' })).ok).toBe(false)
    expect((await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-location', x: 50, y: 20 })).ok).toBe(true)
  })

  it('creates assignment-linked definition-backed and legacy submissions', async () => {
    expect((await createAssignmentLinkedSubmission({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-definition' })).ok).toBe(true)
    expect((await createAssignmentLinkedSubmission({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'player-1', matchDayEventTypeId: 'selected-legacy' })).ok).toBe(true)
  })
})
