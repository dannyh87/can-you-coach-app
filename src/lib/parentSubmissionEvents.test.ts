import type { MatchEventType } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

import {
  acceptSubmittedMatchEvent,
  buildAcceptedSubmissionMatchEventData,
  createDefinitionEventKey,
  createLegacyEventKey,
  getClubDefinitionSnapshotWarnings,
  getParentSubmissionEventDisplayName,
  getParentSubmissionEventOptions,
  getReviewIdentityLabel,
  parseParentSubmissionEventKey,
  resolveSelectedParentSubmissionEvent,
  submissionsHaveSameEventIdentity,
  type SelectedParentSubmissionEvent,
} from '@/lib/parentSubmissionEvents'

vi.mock('@/lib/permissions', () => ({ canRunMatchDay: vi.fn(async () => true) }))

const legacyType = (value: string) => value as MatchEventType

const selectedEvents: SelectedParentSubmissionEvent[] = [
  {
    id: 'selected-goal',
    eventType: legacyType('GOAL'),
    eventDefinitionId: 'definition-goal',
    eventDefinition: {
      id: 'definition-goal',
      name: 'Goal scored',
      description: 'Ball crosses the line.',
      legacyEventType: legacyType('GOAL'),
      requiresLocation: false,
    },
  },
  {
    id: 'selected-press',
    eventType: null,
    eventDefinitionId: 'definition-press',
    eventDefinition: {
      id: 'definition-press',
      name: 'Successful press',
      description: 'Forces a rushed decision.',
      legacyEventType: null,
      requiresLocation: false,
    },
  },
  {
    id: 'selected-touch',
    eventType: legacyType('TOUCH'),
    eventDefinitionId: 'definition-touch',
    eventDefinition: {
      id: 'definition-touch',
      name: 'Touch map touch',
      description: null,
      legacyEventType: legacyType('TOUCH'),
      requiresLocation: true,
    },
  },
  {
    id: 'selected-assist-legacy',
    eventType: legacyType('ASSIST'),
    eventDefinitionId: null,
    eventDefinition: null,
  },
]

describe('parent submission event keys', () => {
  it('parses definition and legacy keys', () => {
    expect(parseParentSubmissionEventKey('definition:definition-press')).toEqual({
      kind: 'definition',
      eventDefinitionId: 'definition-press',
    })
    expect(parseParentSubmissionEventKey('legacy:GOAL')).toEqual({
      kind: 'legacy',
      eventType: 'GOAL',
    })
  })

  it('rejects malformed and arbitrary keys', () => {
    expect(parseParentSubmissionEventKey('')).toBeNull()
    expect(parseParentSubmissionEventKey('definition:')).toBeNull()
    expect(parseParentSubmissionEventKey('definition:one:two')).toBeNull()
    expect(parseParentSubmissionEventKey('legacy:NOT_A_REAL_EVENT')).toBeNull()
    expect(parseParentSubmissionEventKey('definition-press')).toBeNull()
  })
})

describe('selected parent submission events', () => {
  it('resolves selected definition-backed events', () => {
    const event = resolveSelectedParentSubmissionEvent({
      eventKey: createDefinitionEventKey('definition-press'),
      selectedEvents,
    })

    expect(event).toMatchObject({
      eventKey: 'definition:definition-press',
      eventDefinitionId: 'definition-press',
      eventType: null,
      label: 'Successful press',
      requiresLocation: false,
    })
  })

  it('resolves selected legacy-only events', () => {
    const event = resolveSelectedParentSubmissionEvent({
      eventKey: createLegacyEventKey(legacyType('ASSIST')),
      selectedEvents,
    })

    expect(event).toMatchObject({
      eventKey: 'legacy:ASSIST',
      eventDefinitionId: null,
      eventType: 'ASSIST',
      label: 'Assist',
    })
  })

  it('uses definition as canonical identity when legacy mapping also exists', () => {
    const event = resolveSelectedParentSubmissionEvent({
      eventKey: createLegacyEventKey(legacyType('GOAL')),
      selectedEvents,
    })

    expect(event).toMatchObject({
      eventKey: 'definition:definition-goal',
      eventDefinitionId: 'definition-goal',
      eventType: 'GOAL',
      label: 'Goal scored',
    })
  })

  it('rejects unselected definitions and arbitrary legacy events', () => {
    expect(resolveSelectedParentSubmissionEvent({
      eventKey: createDefinitionEventKey('definition-unselected'),
      selectedEvents,
    })).toBeNull()
    expect(resolveSelectedParentSubmissionEvent({
      eventKey: createLegacyEventKey(legacyType('SHOT_ON_TARGET')),
      selectedEvents,
    })).toBeNull()
  })

  it('dedupes buttons by canonical event identity', () => {
    const options = getParentSubmissionEventOptions([
      ...selectedEvents,
      { ...selectedEvents[0], id: 'selected-goal-duplicate' },
    ])

    expect(options.map((event) => event.eventKey)).toEqual([
      'definition:definition-goal',
      'definition:definition-press',
      'definition:definition-touch',
      'legacy:ASSIST',
    ])
  })
})

describe('parent submission duplicate identity', () => {
  it('matches definition-backed submissions by definition id', () => {
    expect(submissionsHaveSameEventIdentity(
      { eventDefinitionId: 'definition-goal', eventType: legacyType('GOAL') },
      { eventDefinitionId: 'definition-goal', eventType: null }
    )).toBe(true)
  })

  it('does not conflate legacy and definition identities with different definitions', () => {
    expect(submissionsHaveSameEventIdentity(
      { eventDefinitionId: 'definition-goal', eventType: legacyType('GOAL') },
      { eventDefinitionId: 'definition-other-goal', eventType: legacyType('GOAL') }
    )).toBe(false)
  })

  it('matches legacy-only submissions by event type', () => {
    expect(submissionsHaveSameEventIdentity(
      { eventDefinitionId: null, eventType: legacyType('ASSIST') },
      { eventDefinitionId: null, eventType: legacyType('ASSIST') }
    )).toBe(true)
  })
})

describe('parent submission display and acceptance mapping', () => {
  it('prefers event definition names but falls back to legacy labels', () => {
    expect(getParentSubmissionEventDisplayName({
      eventType: legacyType('GOAL'),
      eventDefinition: { name: 'Goal scored' },
    })).toBe('Goal scored')
    expect(getParentSubmissionEventDisplayName({
      eventType: legacyType('SHOT_ON_TARGET'),
      eventDefinition: null,
    })).toBe('Shot on target')
  })

  it('maps accepted definition-backed submissions to official match event fields', () => {
    expect(buildAcceptedSubmissionMatchEventData({
      matchDayId: 'match-1',
      playerId: 'player-1',
      eventDefinitionId: 'definition-press',
      eventDefinition: { legacyEventType: null },
      eventType: null,
      half: 'FIRST_HALF',
      matchSecond: 123,
      ownScoreAtTime: 1,
      oppositionScoreAtTime: 0,
    })).toMatchObject({
      matchDayId: 'match-1',
      playerId: 'player-1',
      eventDefinitionId: 'definition-press',
      eventType: null,
      half: 'FIRST_HALF',
      matchSecond: 123,
      ownScoreAtTime: 1,
      oppositionScoreAtTime: 0,
      x: null,
      y: null,
    })
  })

  it('retains mapped legacy values for accepted definition-backed submissions', () => {
    expect(buildAcceptedSubmissionMatchEventData({
      matchDayId: 'match-1',
      playerId: 'player-1',
      eventDefinitionId: 'definition-goal',
      eventDefinition: { legacyEventType: legacyType('GOAL') },
      eventType: legacyType('GOAL'),
      half: 'SECOND_HALF',
      matchSecond: 55,
      ownScoreAtTime: 2,
      oppositionScoreAtTime: 1,
    }).eventType).toBe('GOAL')
  })

  it('preserves playerless accepted submissions for unit and team assignments', () => {
    expect(buildAcceptedSubmissionMatchEventData({
      matchDayId: 'match-1',
      playerId: null,
      eventDefinitionId: 'definition-press',
      eventDefinition: { legacyEventType: null },
      eventType: null,
      half: 'FIRST_HALF',
      matchSecond: 42,
      ownScoreAtTime: 0,
      oppositionScoreAtTime: 0,
    })).toMatchObject({ playerId: null })
  })

  it('copies club provenance for accepted club-only event submissions', () => {
    expect(buildAcceptedSubmissionMatchEventData({
      id: 'submitted-1',
      matchDayId: 'match-1',
      playerId: null,
      eventDefinitionId: null,
      eventDefinition: null,
      eventType: null,
      clubTrackingDefinitionId: 'club-definition-1',
      standardEventDefinitionIdAtRecording: 'proposed-standard-1',
      clubMappingRevisionAtRecording: 3,
      clubMappingStatusAtRecording: 'CLUB_APPROVED',
      half: 'FIRST_HALF',
      matchSecond: 42,
      ownScoreAtTime: 0,
      oppositionScoreAtTime: 0,
    })).toMatchObject({ submittedMatchEventId: 'submitted-1', eventDefinitionId: null, eventType: null, clubTrackingDefinitionId: 'club-definition-1', standardEventDefinitionIdAtRecording: 'proposed-standard-1', clubMappingRevisionAtRecording: 3, clubMappingStatusAtRecording: 'CLUB_APPROVED' })
  })

  it('labels review identity and warns on mapping changes without rename warnings', () => {
    expect(getReviewIdentityLabel({ clubTrackingDefinitionId: null })).toBe('Standard')
    expect(getReviewIdentityLabel({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_ALIAS', mappingStatusAtRecording: 'STANDARD_APPROVED' })).toBe('Club alias')
    expect(getReviewIdentityLabel({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_MAPPED', mappingStatusAtRecording: 'STANDARD_APPROVED' })).toBe('Club mapped - standard approved')
    expect(getReviewIdentityLabel({ clubTrackingDefinitionId: 'club-1', clubDefinitionKind: 'EVENT_MAPPED', mappingStatusAtRecording: 'CLUB_APPROVED' })).toBe('Club mapped - club only')
    expect(getClubDefinitionSnapshotWarnings({ recordedMappingStatus: 'CLUB_APPROVED', recordedMappingRevision: 2, recordedStandardEventDefinitionId: 'event-old', currentDefinition: { status: 'RETIRED', active: false, retiredAt: new Date('2026-01-01'), mappingStatus: 'STANDARD_APPROVED', mappingRevision: 3, mappedEventDefinitionId: 'event-new', mappedEventDefinition: { isActive: false } } })).toEqual(expect.arrayContaining(['This definition has since been retired.', 'The mapping status changed after this observation was recorded.', 'Recorded under mapping revision 2; the current revision is 3.', 'The mapped standard identity changed after recording.', 'The mapped standard definition is no longer active.']))
  })

  it('accepts club-only event submissions without current MatchDayEventType and stores source link', async () => {
    let createdData = {} as Record<string, unknown>
    const db = {
      matchEvent: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: 'official-1' } }) },
      submittedMatchEvent: { findFirst: vi.fn(async () => ({ id: 'submitted-1', matchDayId: 'match-1', playerId: null, submittedByUserId: 'contributor-1', eventDefinitionId: null, eventType: null, clubTrackingDefinitionId: 'club-definition-1', standardEventDefinitionIdAtRecording: null, clubMappingRevisionAtRecording: 1, clubMappingStatusAtRecording: 'NONE', assignmentId: 'assignment-1', half: 'FIRST_HALF', matchSecond: 1, ownScoreAtTime: 0, oppositionScoreAtTime: 0, x: null, y: null, status: 'PENDING', eventDefinition: null, clubTrackingDefinition: { id: 'club-definition-1' }, assignment: { trackingTask: { scopeType: 'TEAM' } }, matchDay: { status: 'IN_PROGRESS' } })), updateMany: vi.fn(async () => ({ count: 1 })) },
      matchDayPlayer: { findFirst: vi.fn() },
      matchDayEventType: { findFirst: vi.fn(async () => { throw new Error('should not validate selected standard event') }) },
      $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    }
    const result = await acceptSubmittedMatchEvent({ db: db as never, actorUserId: 'coach-1', matchDayId: 'match-1', submittedMatchEventId: 'submitted-1' })
    expect(result).toMatchObject({ ok: true, officialObservationId: 'official-1', alreadyAccepted: false })
    expect(createdData).toMatchObject({ submittedMatchEventId: 'submitted-1', eventDefinitionId: null, eventType: null, clubTrackingDefinitionId: 'club-definition-1' })
  })

  it('returns existing official event on repeated acceptance', async () => {
    const db = {
      matchEvent: { findUnique: vi.fn(async () => ({ id: 'official-existing' })) },
      $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    }
    await expect(acceptSubmittedMatchEvent({ db: db as never, actorUserId: 'coach-1', matchDayId: 'match-1', submittedMatchEventId: 'submitted-1' })).resolves.toMatchObject({ ok: true, officialObservationId: 'official-existing', alreadyAccepted: true })
  })
})
