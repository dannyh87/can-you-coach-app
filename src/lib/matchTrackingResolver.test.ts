import { describe, expect, it } from 'vitest'

import {
  getAdvancedCompatibleEvents,
  getAvailableTargetContexts,
  getAvailableTopics,
  getNextTrackingQuestion,
  getRecommendedEventsForTopic,
  reconcileTrackingSelections,
  searchTrackingTopics,
  validateTrackingSetup,
} from '@/lib/matchTrackingResolver'

const eventDefinitions = [
  { id: 'touch', name: 'Touch', description: 'Touch location.', isActive: true, archivedAt: null, requiresLocation: true, benchmarkable: true, scope: 'GLOBAL', clubId: null, matchPhase: 'IN_POSSESSION', enabledByDefault: false, matchDayGroup: 'POSSESSION' },
  { id: 'pass', name: 'Pass complete', description: 'Completed pass.', isActive: true, archivedAt: null, requiresLocation: false, benchmarkable: true, scope: 'GLOBAL', clubId: null, matchPhase: 'IN_POSSESSION', enabledByDefault: true, matchDayGroup: 'PASSING' },
  { id: 'regain', name: 'Possession gained', description: 'Regain.', isActive: true, archivedAt: null, requiresLocation: true, benchmarkable: true, scope: 'GLOBAL', clubId: null, matchPhase: 'TRANSITION', enabledByDefault: false, matchDayGroup: 'DEFENDING' },
  { id: 'inactive', name: 'Inactive event', description: null, isActive: false, archivedAt: null, requiresLocation: false, benchmarkable: false, scope: 'GLOBAL', clubId: null, matchPhase: 'IN_POSSESSION', enabledByDefault: false, matchDayGroup: 'CUSTOM_OTHER' },
]

const topics = [
  {
    id: 'cf-link', name: 'Centre-forward link play', description: 'Link the attack.', normalizedName: 'centre forward link play', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: true, archivedAt: null, contexts: [{ scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD', recommended: true, displayOrder: 1 }], aliases: [{ alias: 'third man', normalizedAlias: 'third man' }],
    events: [{ eventDefinitionId: 'touch', displayOrder: 0, recommended: true, guidance: null, eventDefinition: eventDefinitions[0] }, { eventDefinitionId: 'pass', displayOrder: 1, recommended: true, guidance: null, eventDefinition: eventDefinitions[1] }, { eventDefinitionId: 'inactive', displayOrder: 2, recommended: false, guidance: null, eventDefinition: eventDefinitions[3] }],
  },
  {
    id: 'cb-progression', name: 'Centre-back progression', description: null, normalizedName: 'centre back progression', phase: 'IN_POSSESSION', focusArea: 'PROGRESSION', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: true, archivedAt: null, contexts: [{ scopeType: 'PLAYER', targetContext: 'CENTRE_BACK', recommended: true, displayOrder: 1 }], aliases: [],
    events: [{ eventDefinitionId: 'pass', displayOrder: 0, recommended: true, guidance: null, eventDefinition: eventDefinitions[1] }],
  },
  {
    id: 'def-unit', name: 'Defensive unit protecting space behind', description: null, normalizedName: 'defensive unit protecting space behind', phase: 'OUT_OF_POSSESSION', focusArea: 'PROTECTING_SPACE_BEHIND', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: true, archivedAt: null, contexts: [{ scopeType: 'UNIT', targetContext: 'DEFENSIVE_UNIT', recommended: true, displayOrder: 1 }], aliases: [{ alias: 'balls in behind', normalizedAlias: 'balls in behind' }],
    events: [{ eventDefinitionId: 'regain', displayOrder: 0, recommended: true, guidance: 'Broad proxy for defending space behind.', eventDefinition: eventDefinitions[2] }],
  },
  {
    id: 'team-counter', name: 'Counter-attacking effectiveness', description: null, normalizedName: 'counter attacking effectiveness', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: true, archivedAt: null, contexts: [{ scopeType: 'TEAM', targetContext: 'WHOLE_TEAM', recommended: true, displayOrder: 1 }], aliases: [{ alias: 'counter attack', normalizedAlias: 'counter attack' }],
    events: [{ eventDefinitionId: 'regain', displayOrder: 0, recommended: true, guidance: null, eventDefinition: eventDefinitions[2] }],
  },
  { id: 'inactive-topic', name: 'Inactive topic', normalizedName: 'inactive topic', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', agePhases: ['YOUTH'], suggestedMaxEvents: 6, isActive: false, archivedAt: null, contexts: [{ scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD', recommended: true, displayOrder: 0 }], aliases: [], events: [] },
]

type MockTopicWhere = {
  id?: string
  AND?: MockTopicWhere[]
  OR?: Array<MockTopicWhere | { normalizedName?: { contains: string }; aliases?: { some: { normalizedAlias: { contains: string } } } }>
  isActive?: boolean
  phase?: string
  focusArea?: string
  contexts?: { some: { scopeType?: string; OR?: Array<{ targetContext: string | null }> } }
  matchPhase?: { in: string[] }
  normalizedName?: { contains: string }
  aliases?: { some: { normalizedAlias: { contains: string } } }
}

function matchesContext(topic: typeof topics[number], where?: MockTopicWhere) {
  if (where?.AND && !where.AND.every((item) => matchesContext(topic, item))) return false
  if (where?.OR && !where.OR.some((item) => matchesContext(topic, item as MockTopicWhere))) return false
  if (where?.isActive && !topic.isActive) return false
  if (where?.phase && topic.phase !== where.phase) return false
  if (where?.focusArea && topic.focusArea !== where.focusArea) return false
  if (where?.normalizedName && !topic.normalizedName.includes(where.normalizedName.contains)) return false
  if (where?.aliases && !topic.aliases.some((alias) => alias.normalizedAlias.includes(where.aliases!.some.normalizedAlias.contains))) return false
  const contextFilter = where?.contexts?.some
  if (!contextFilter) return true
  return topic.contexts.some((context) => context.scopeType === contextFilter.scopeType && (!contextFilter.OR || contextFilter.OR.some((candidate) => candidate.targetContext === context.targetContext || candidate.targetContext === null && context.targetContext === null)))
}

function createDb() {
  return {
    eventTopic: {
      findMany: async ({ where }: { where?: MockTopicWhere }) => topics.filter((topic) => matchesContext(topic, where)),
      findFirst: async ({ where }: { where: MockTopicWhere }) => topics.find((topic) => topic.id === where.id && matchesContext(topic, where)) ?? null,
    },
    eventDefinition: {
      findMany: async ({ where }: { where?: MockTopicWhere }) => eventDefinitions.filter((event) => event.isActive && (!where?.matchPhase?.in || where.matchPhase.in.includes(event.matchPhase))),
    },
  } as never
}

describe('match tracking resolver', () => {
  it('branches by player, unit and team scope', async () => {
    expect((await getNextTrackingQuestion({}, createDb()))?.key).toBe('scope')
    expect(getAvailableTargetContexts({ scope: 'PLAYER' })?.key).toBe('targetContext')
    expect(getAvailableTargetContexts({ scope: 'UNIT' })?.key).toBe('targetContext')
    expect(getAvailableTargetContexts({ scope: 'TEAM' })).toBeNull()
  })

  it('filters topics by role, unit, phase and focus area while excluding inactive topics', async () => {
    const playerTopics = await getAvailableTopics({ scope: 'PLAYER', targetContext: 'CENTRE_FORWARD', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY' }, createDb())
    const unitTopics = await getAvailableTopics({ scope: 'UNIT', targetContext: 'DEFENSIVE_UNIT', phase: 'OUT_OF_POSSESSION', focusArea: 'PROTECTING_SPACE_BEHIND' }, createDb())
    const invalidTopics = await getAvailableTopics({ scope: 'PLAYER', targetContext: 'CENTRE_BACK', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY' }, createDb())

    expect(playerTopics.options.map((option) => option.label)).toEqual(['Centre-forward link play'])
    expect(unitTopics.options.map((option) => option.label)).toEqual(['Defensive unit protecting space behind'])
    expect(invalidTopics.options).toEqual([])
    expect(invalidTopics.noResultsReason).toContain('No standard topics')
  })

  it('returns recommended topic events with metadata and excludes disabled definitions', async () => {
    const result = await getRecommendedEventsForTopic('cf-link', { scope: 'PLAYER', targetContext: 'CENTRE_FORWARD' }, createDb())
    expect(result?.events.map((event) => event.eventDefinitionId)).toEqual(['touch', 'pass'])
    expect(result?.events[0]).toMatchObject({ requiresLocation: true, benchmarkable: true })
  })

  it('searches topic names and aliases case-insensitively', async () => {
    const aliasResults = await searchTrackingTopics('THIRD MAN', { scope: 'PLAYER', targetContext: 'CENTRE_FORWARD' }, createDb())
    const nameResults = await searchTrackingTopics('counter', { scope: 'TEAM' }, createDb())
    expect(aliasResults[0]).toMatchObject({ topicId: 'cf-link' })
    expect(nameResults[0]).toMatchObject({ topicId: 'team-counter' })
  })

  it('reconciles changed context and resets invalid downstream selections', async () => {
    const result = await reconcileTrackingSelections({ scope: 'PLAYER', targetContext: 'CENTRE_FORWARD', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', topicId: 'cf-link', selectedEventDefinitionIds: ['touch'] }, { targetContext: 'CENTRE_BACK' }, createDb())
    expect(result.invalidated).toContain('topicId')
    expect(result.preserved.topicId).toBeUndefined()
  })

  it('validates guided and advanced-compatible standard setups', async () => {
    await expect(validateTrackingSetup({ scope: 'PLAYER', targetContext: 'CENTRE_FORWARD', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', topicId: 'missing', selectedEventDefinitionIds: ['touch'] }, createDb())).resolves.toMatchObject({ ok: false })
    await expect(validateTrackingSetup({ scope: 'PLAYER', targetContext: 'CENTRE_FORWARD', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', topicId: 'cf-link', selectedEventDefinitionIds: ['touch'] }, createDb())).resolves.toMatchObject({ ok: true, mode: 'STANDARD_GUIDED' })
    await expect(validateTrackingSetup({ scope: 'TEAM', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', mode: 'STANDARD_ADVANCED', selectedEventDefinitionIds: ['regain'] }, createDb())).resolves.toMatchObject({ ok: true, mode: 'STANDARD_ADVANCED' })
  })

  it('marks advanced events outside the chosen topic', async () => {
    const events = await getAdvancedCompatibleEvents({ scope: 'PLAYER', targetContext: 'CENTRE_FORWARD', phase: 'IN_POSSESSION', topicId: 'cf-link' }, createDb())
    expect(events.find((event) => event.eventDefinitionId === 'pass')).toMatchObject({ recommendedByTopic: true, outsideChosenTopic: false })
  })
})
