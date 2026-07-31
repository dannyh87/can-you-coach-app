import { describe, expect, it } from 'vitest'

import {
  applyPlayerTrackingTaskToPlayersV2,
  createGuidedMatchTrackingTaskV2,
  ensureMatchDayEventTypesForDefinitions,
  publishMatchDayV2Setup,
  saveMatchDayV2Squad,
} from '@/lib/matchDayV2Setup'

const eventDefinitions = [
  { id: 'touch', legacyEventType: 'TOUCH', name: 'Touch', description: 'Touch location.', isActive: true, archivedAt: null, requiresLocation: true, benchmarkable: true, scope: 'GLOBAL', clubId: null, matchPhase: 'IN_POSSESSION', category: 'RECEIVING', enabledByDefault: false, matchDayGroup: 'POSSESSION' },
  { id: 'pass', legacyEventType: 'PASS_COMPLETE', name: 'Pass complete', description: 'Completed pass.', isActive: true, archivedAt: null, requiresLocation: false, benchmarkable: true, scope: 'GLOBAL', clubId: null, matchPhase: 'IN_POSSESSION', category: 'PASSING', enabledByDefault: true, matchDayGroup: 'PASSING' },
  { id: 'regain', legacyEventType: null, name: 'Possession gained', description: 'Regain.', isActive: true, archivedAt: null, requiresLocation: true, benchmarkable: true, scope: 'GLOBAL', clubId: null, matchPhase: 'TRANSITION', category: 'DEFENDING', enabledByDefault: false, matchDayGroup: 'DEFENDING' },
]

const topics = [
  {
    id: 'cf-link', name: 'Centre-forward link play', description: 'Link the attack.', normalizedName: 'centre forward link play', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: true, archivedAt: null, contexts: [{ scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD', recommended: true, displayOrder: 1 }], aliases: [],
    events: [
      { eventDefinitionId: 'touch', displayOrder: 0, recommended: true, guidance: null, eventDefinition: eventDefinitions[0] },
      { eventDefinitionId: 'pass', displayOrder: 1, recommended: true, guidance: null, eventDefinition: eventDefinitions[1] },
    ],
    patterns: [{ patternId: 'pattern-1', displayOrder: 2, recommended: true, observerLoadWeight: 2, pattern: { id: 'pattern-1', name: 'Striker receives and sets', description: 'Receive into feet and set support.', active: true, requiresLocation: false, contexts: [{ scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD' }], steps: [{ stepOrder: 0, eventDefinitionId: 'touch', label: 'Pass into striker', eventDefinition: eventDefinitions[0] }], outcomes: [{ id: 'outcome-1', code: 'RETAINED', label: 'Retained possession' }] } }],
  },
  {
    id: 'team-counter', name: 'Counter-attacking effectiveness', description: null, normalizedName: 'counter attacking effectiveness', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: true, archivedAt: null, contexts: [{ scopeType: 'TEAM', targetContext: 'WHOLE_TEAM', recommended: true, displayOrder: 1 }], aliases: [],
    events: [{ eventDefinitionId: 'regain', displayOrder: 0, recommended: true, guidance: null, eventDefinition: eventDefinitions[2] }],
    patterns: [],
  },
]

type MockTopicWhere = {
  id?: string
  AND?: MockTopicWhere[]
  OR?: Array<MockTopicWhere | { ownerScope?: string; clubId?: string | null }>
  isActive?: boolean
  archivedAt?: null
  phase?: string
  focusArea?: string
  contexts?: { some: { scopeType?: string; OR?: Array<{ targetContext: string | null }> } }
  matchPhase?: { in: string[] }
}

function matchesTopic(topic: typeof topics[number], where?: MockTopicWhere) {
  if (where?.AND && !where.AND.every((item) => matchesTopic(topic, item))) return false
  if (where?.id && topic.id !== where.id) return false
  if (where?.isActive && !topic.isActive) return false
  if (where?.phase && topic.phase !== where.phase) return false
  if (where?.focusArea && topic.focusArea !== where.focusArea) return false
  const contextFilter = where?.contexts?.some
  if (!contextFilter) return true
  return topic.contexts.some((context) => context.scopeType === contextFilter.scopeType && (!contextFilter.OR || contextFilter.OR.some((candidate) => candidate.targetContext === context.targetContext || candidate.targetContext === null && context.targetContext === null)))
}

function createDb(overrides: Record<string, unknown> = {}) {
  const createdRows: Array<Record<string, unknown>> = []
  const createdTasks: Array<Record<string, unknown>> = []
  const createdTaskEvents: Array<Record<string, unknown>> = []
  const createdTaskPatterns: Array<Record<string, unknown>> = []
  const db = {
    _createdRows: createdRows,
    _createdTasks: createdTasks,
    _createdTaskEvents: createdTaskEvents,
    _createdTaskPatterns: createdTaskPatterns,
    $transaction: async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input)
      if (typeof input === 'function') return input(db)
      return input
    },
    matchDay: { findUnique: async () => ({ id: 'match-1', teamId: 'team-1', status: 'DRAFT', team: { clubId: 'club-1' } }) },
    player: { findMany: async () => [{ id: 'player-1', squadNumber: 9 }, { id: 'player-2', squadNumber: 10 }] },
    matchDayPlayer: {
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({ id: 'match-player', ...create, ...update }),
      findFirst: async ({ where }: { where: { playerId?: string } }) => where.playerId === 'player-1' ? { id: 'match-player-1' } : null,
      findMany: async ({ where }: { where?: { playerId?: { in: string[] } } }) => (where?.playerId?.in ?? ['player-1', 'player-2']).map((playerId) => ({ playerId })),
    },
    eventDefinition: {
      findMany: async ({ where }: { where?: { id?: { in: string[] }; matchPhase?: { in: string[] } } }) => eventDefinitions.filter((event) => (!where?.id?.in || where.id.in.includes(event.id)) && (!where?.matchPhase?.in || where.matchPhase.in.includes(event.matchPhase))),
    },
    eventTopic: {
      findMany: async ({ where }: { where?: MockTopicWhere }) => topics.filter((topic) => matchesTopic(topic, where)),
      findFirst: async ({ where }: { where: MockTopicWhere }) => topics.find((topic) => matchesTopic(topic, where)) ?? null,
    },
    matchDayEventType: {
      upsert: async ({ where, create }: { where: { matchDayId_eventDefinitionId: { eventDefinitionId: string } }; create: Record<string, unknown> }) => {
        const row = { id: `selected-${where.matchDayId_eventDefinitionId.eventDefinitionId}`, eventDefinitionId: where.matchDayId_eventDefinitionId.eventDefinitionId, ...create }
        createdRows.push(row)
        return row
      },
      findMany: async () => [],
    },
    matchTrackingTask: {
      findUnique: async () => ({ id: 'source-task', matchDayId: 'match-1', createdByUserId: 'coach-1', topicId: 'cf-link', scopeType: 'PLAYER', playerId: 'player-1', unitKey: null, unitLabel: null, title: 'Watch link play', instructions: 'Same cues.', sourceTaskId: null, status: 'READY', events: [{ matchDayEventTypeId: 'selected-touch' }, { matchDayEventTypeId: 'selected-pass' }], patterns: [{ patternId: 'pattern-1' }] }),
      findMany: async () => [{ id: 'task-1', matchDayId: 'match-1', scopeType: 'PLAYER', playerId: 'player-1', unitKey: null, unitLabel: null, title: 'Watch link play', status: 'READY', events: [{ id: 'event-1' }] }],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdTasks.push(data)
        return { id: 'task-1' }
      },
    },
    matchTrackingTaskEvent: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        createdTaskEvents.push(...data)
        return { count: data.length }
      },
    },
    matchTrackingTaskPattern: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        createdTaskPatterns.push(...data)
        return { count: data.length }
      },
    },
    trackingPatternDefinition: {
      findMany: async () => [{ id: 'pattern-1', name: 'Striker receives and sets', description: 'Receive into feet and set support.', active: true, requiresLocation: false, ownerScope: 'GLOBAL', aliases: [{ alias: 'set' }], contexts: [{ scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD' }], steps: [{ stepOrder: 0, eventDefinitionId: 'touch', label: 'Pass into striker', eventDefinition: eventDefinitions[0] }], outcomes: [{ id: 'outcome-1', code: 'RETAINED', label: 'Retained possession' }] }],
    },
    ...overrides,
  }
  return db as never
}

describe('match day v2 setup', () => {
  it('persists full squad status against active team players', async () => {
    const result = await saveMatchDayV2Squad({ db: createDb(), userId: 'coach-1', matchDayId: 'match-1', players: [{ playerId: 'player-1', squadStatus: 'STARTER', startingPosition: '9' }] })

    expect(result.ok).toBe(true)
  })

  it('creates missing match event rows without replacing existing setup', async () => {
    const db = createDb() as never as { _createdRows: Array<Record<string, unknown>> }
    const result = await ensureMatchDayEventTypesForDefinitions({ db: db as never, userId: 'coach-1', matchDayId: 'match-1', eventDefinitionIds: ['touch', 'pass', 'touch'] })

    expect(result).toMatchObject({ ok: true, value: [{ eventDefinitionId: 'touch' }, { eventDefinitionId: 'pass' }] })
    expect(db._createdRows).toHaveLength(2)
  })

  it('creates a ready player task from a compatible resolver topic', async () => {
    const db = createDb() as never as { _createdTasks: Array<Record<string, unknown>>; _createdTaskEvents: Array<Record<string, unknown>> }
    const result = await createGuidedMatchTrackingTaskV2({
      db: db as never,
      userId: 'coach-1',
      matchDayId: 'match-1',
      scope: 'PLAYER',
      targetContext: 'CENTRE_FORWARD',
      phase: 'IN_POSSESSION',
      focusArea: 'LINK_PLAY',
      topicId: 'cf-link',
      selectedEventDefinitionIds: ['touch', 'pass'],
      playerId: 'player-1',
      title: 'Watch link play',
    })

    expect(result).toEqual({ ok: true, value: { id: 'task-1' } })
    expect(db._createdTasks[0]).toMatchObject({ topicId: 'cf-link', status: 'READY', scopeType: 'PLAYER', playerId: 'player-1' })
    expect(db._createdTaskEvents).toHaveLength(2)
  })

  it('creates a pattern-only guided task without placeholder event rows', async () => {
    const db = createDb() as never as { _createdTaskEvents: Array<Record<string, unknown>>; _createdTaskPatterns: Array<Record<string, unknown>> }
    const result = await createGuidedMatchTrackingTaskV2({
      db: db as never,
      userId: 'coach-1',
      matchDayId: 'match-1',
      scope: 'PLAYER',
      targetContext: 'CENTRE_FORWARD',
      phase: 'IN_POSSESSION',
      focusArea: 'LINK_PLAY',
      topicId: 'cf-link',
      selectedEventDefinitionIds: [],
      selectedPatternIds: ['pattern-1'],
      playerId: 'player-1',
      title: 'Watch striker sets',
    })

    expect(result).toEqual({ ok: true, value: { id: 'task-1' } })
    expect(db._createdTaskEvents).toHaveLength(0)
    expect(db._createdTaskPatterns).toEqual([expect.objectContaining({ patternId: 'pattern-1', displayOrder: 0 })])
  })

  it('rejects duplicate guided pattern selections', async () => {
    const result = await createGuidedMatchTrackingTaskV2({ db: createDb(), userId: 'coach-1', matchDayId: 'match-1', scope: 'PLAYER', targetContext: 'CENTRE_FORWARD', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', topicId: 'cf-link', selectedEventDefinitionIds: [], selectedPatternIds: ['pattern-1', 'pattern-1'], playerId: 'player-1', title: 'Duplicates' })

    expect(result).toMatchObject({ ok: false })
  })

  it('rejects incompatible guided topic selections', async () => {
    const result = await createGuidedMatchTrackingTaskV2({
      db: createDb(),
      userId: 'coach-1',
      matchDayId: 'match-1',
      scope: 'PLAYER',
      targetContext: 'CENTRE_BACK',
      phase: 'IN_POSSESSION',
      focusArea: 'LINK_PLAY',
      topicId: 'cf-link',
      selectedEventDefinitionIds: ['touch'],
      playerId: 'player-1',
      title: 'Invalid setup',
    })

    expect(result.ok).toBe(false)
  })

  it('applies one player task to multiple additional players without copying assignments', async () => {
    const db = createDb() as never as { _createdTasks: Array<Record<string, unknown>>; _createdTaskEvents: Array<Record<string, unknown>> }
    const result = await applyPlayerTrackingTaskToPlayersV2({ db: db as never, userId: 'coach-1', sourceTaskId: 'source-task', playerIds: ['player-1', 'player-2', 'player-2'] })

    expect(result).toEqual({ ok: true, value: { ids: ['task-1'] } })
    expect(db._createdTasks).toEqual([expect.objectContaining({ playerId: 'player-2', sourceTaskId: 'source-task', status: 'READY' })])
    expect(db._createdTaskEvents).toHaveLength(2)
  })

  it('publishes valid setup with unassigned-task warnings', async () => {
    const result = await publishMatchDayV2Setup({
      db: createDb({
        matchDay: {
          findUnique: async ({ select }: { select?: Record<string, unknown> }) => select?.matchTrackingTasks
            ? { id: 'match-1', status: 'DRAFT', matchDayPlayers: [{ id: 'mp-1' }], matchTrackingTasks: [{ id: 'task-1', title: 'Watch link play', scopeType: 'PLAYER', playerId: 'player-1', unitLabel: null, status: 'READY', player: { firstName: 'Jake', surname: 'Smith' }, topic: { name: 'Link play' }, events: [{ id: 'event-1' }], assignments: [] }] }
            : { id: 'match-1', teamId: 'team-1', status: 'DRAFT', opposition: 'Rovers', kickoffAt: new Date('2026-08-01T10:00:00Z'), team: { clubId: 'club-1' } },
        },
      }),
      userId: 'coach-1',
      matchDayId: 'match-1',
    })

    expect(result).toMatchObject({ ok: true, value: { coverage: { totalTasks: 1, unassigned: 1 } } })
    expect(result.ok && result.value.warnings[0]).toContain('unassigned')
  })
})
