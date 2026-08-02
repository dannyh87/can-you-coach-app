import { describe, expect, it } from 'vitest'

import { createAssignmentLinkedSubmission, recordAssignedClubEvent, validateAssignmentSubmissionContext } from '@/lib/matchTrackingSubmissions'

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

const clubAssignment = {
  id: 'assignment-1',
  assignedUserId: 'user-1',
  status: 'IN_PROGRESS',
  trackingTaskId: 'task-1',
  trackingTask: {
    id: 'task-1',
    matchDayId: 'match-1',
    status: 'READY',
    scopeType: 'PLAYER',
    playerId: 'player-1',
    unitKey: null,
    matchDay: { ...liveMatch, team: { clubId: 'club-1' } },
    clubDefinitions: [{
      id: 'task-club-1',
      selectedKind: 'EVENT_ALIAS',
      standardEventDefinitionIdAtSelection: 'definition-1',
      clubTrackingDefinition: {
        id: 'club-definition-1', clubId: 'club-1', kind: 'EVENT_ALIAS', status: 'APPROVED', active: true, retiredAt: null, name: 'Break the line', requiresLocation: false, mappedEventDefinitionId: 'definition-1', mappedPatternDefinitionId: null, mappingStatus: 'STANDARD_APPROVED', mappingRevision: 2, standardMappingRejectionCategory: null, scopeType: 'PLAYER', targetContext: null, phase: null, focusArea: null,
        mappedEventDefinition: { id: 'definition-1', requiresLocation: false, legacyEventType: 'PASS_COMPLETE' },
      },
    }],
  },
}

function createDb(overrides: Record<string, unknown> = {}) {
    const db = {
      matchContributorAssignment: { findUnique: async () => assignment },
      matchDayPlayer: { findFirst: async () => ({ id: 'match-player-1' }) },
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

function createClubDb(overrides: Record<string, unknown> = {}) {
  const db = {
    matchContributorAssignment: { findUnique: async () => clubAssignment },
    matchDayPlayer: { findFirst: async () => ({ id: 'match-player-1' }) },
    matchPlayerStint: { findFirst: async () => ({ id: 'stint-1' }) },
    submittedMatchEvent: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `submission:${data.clubTrackingDefinitionId}` }) },
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

  it('requires player assignments to submit the assigned player', async () => {
    expect((await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: null, matchDayEventTypeId: 'selected-definition' })).ok).toBe(false)
    expect((await validateAssignmentSubmissionContext({ db: createDb(), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: 'other-player', matchDayEventTypeId: 'selected-definition' })).ok).toBe(false)
  })

  it('allows unit and team assignments to submit without a player', async () => {
    const unitAssignment = { ...assignment, trackingTask: { ...assignment.trackingTask, scopeType: 'UNIT', playerId: null, unitKey: 'def', unitLabel: 'Defence' } }
    const teamAssignment = { ...assignment, trackingTask: { ...assignment.trackingTask, scopeType: 'TEAM', playerId: null, unitKey: null, unitLabel: null } }

    const unitResult = await validateAssignmentSubmissionContext({ db: createDb({ matchContributorAssignment: { findUnique: async () => unitAssignment } }), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: null, matchDayEventTypeId: 'selected-definition' })
    const teamResult = await validateAssignmentSubmissionContext({ db: createDb({ matchContributorAssignment: { findUnique: async () => teamAssignment } }), assignmentId: 'assignment-1', actorUserId: 'user-1', matchDayId: 'match-1', playerId: null, matchDayEventTypeId: 'selected-definition' })

    expect(unitResult).toMatchObject({ ok: true, value: { playerId: null } })
    expect(teamResult).toMatchObject({ ok: true, value: { playerId: null } })
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

  it('records club event alias provenance with standard identity', async () => {
    let createdData = {} as Record<string, unknown>
    const result = await recordAssignedClubEvent({ db: createClubDb({ submittedMatchEvent: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: 'submission-1' } } } }), assignmentId: 'assignment-1', actorUserId: 'user-1', taskClubDefinitionId: 'task-club-1', playerId: 'player-1' })

    expect(result).toMatchObject({ ok: true, observationId: 'submission-1' })
    expect(createdData).toMatchObject({ eventDefinitionId: 'definition-1', standardEventDefinitionIdAtRecording: 'definition-1', clubTrackingDefinitionId: 'club-definition-1', clubMappingRevisionAtRecording: 2, clubMappingStatusAtRecording: 'STANDARD_APPROVED' })
  })

  it('records custom club events without fake standard identity', async () => {
    let createdData = {} as Record<string, unknown>
    const customAssignment = { ...clubAssignment, trackingTask: { ...clubAssignment.trackingTask, clubDefinitions: [{ ...clubAssignment.trackingTask.clubDefinitions[0], selectedKind: 'EVENT_CUSTOM', standardEventDefinitionIdAtSelection: null, clubTrackingDefinition: { ...clubAssignment.trackingTask.clubDefinitions[0].clubTrackingDefinition, kind: 'EVENT_CUSTOM', mappedEventDefinitionId: null, mappedEventDefinition: null, mappingStatus: 'NONE' } }] } }
    const result = await recordAssignedClubEvent({ db: createClubDb({ matchContributorAssignment: { findUnique: async () => customAssignment }, submittedMatchEvent: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: 'submission-1' } } } }), assignmentId: 'assignment-1', actorUserId: 'user-1', taskClubDefinitionId: 'task-club-1', playerId: 'player-1' })

    expect(result.ok).toBe(true)
    expect(createdData).toMatchObject({ eventDefinitionId: null, eventType: null, standardEventDefinitionIdAtRecording: null, clubMappingStatusAtRecording: 'NONE' })
  })

  it('blocks stale club event target changes and rapid duplicates', async () => {
    const staleAssignment = { ...clubAssignment, trackingTask: { ...clubAssignment.trackingTask, clubDefinitions: [{ ...clubAssignment.trackingTask.clubDefinitions[0], standardEventDefinitionIdAtSelection: 'old-definition' }] } }
    await expect(recordAssignedClubEvent({ db: createClubDb({ matchContributorAssignment: { findUnique: async () => staleAssignment } }), assignmentId: 'assignment-1', actorUserId: 'user-1', taskClubDefinitionId: 'task-club-1', playerId: 'player-1' })).resolves.toMatchObject({ ok: false, reason: 'taskDefinitionStale' })
    await expect(recordAssignedClubEvent({ db: createClubDb({ submittedMatchEvent: { findFirst: async () => ({ id: 'duplicate' }) } }), assignmentId: 'assignment-1', actorUserId: 'user-1', taskClubDefinitionId: 'task-club-1', playerId: 'player-1' })).resolves.toMatchObject({ ok: false, reason: 'duplicateSubmission' })
  })
})
