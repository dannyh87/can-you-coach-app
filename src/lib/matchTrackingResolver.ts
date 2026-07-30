import type {
  EventDefinitionAgePhase,
  EventDefinitionMatchPhase,
  MatchTrackingScope,
  Prisma,
  TrackingFocusArea,
  TrackingTargetContext,
  TrackingTopicPhase,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'

type Db = typeof prisma | Prisma.TransactionClient

export type TrackingSetupMode = 'STANDARD_GUIDED' | 'STANDARD_ADVANCED' | 'CUSTOM'

export type TrackingResolverContext = {
  scope?: MatchTrackingScope
  targetContext?: TrackingTargetContext
  playerRole?: TrackingTargetContext
  unitType?: TrackingTargetContext
  phase?: TrackingTopicPhase
  focusArea?: TrackingFocusArea
  topicId?: string
  teamId?: string
  clubId?: string
  agePhase?: EventDefinitionAgePhase
  selectedEventDefinitionIds?: string[]
  mode?: TrackingSetupMode
}

export type TrackingResolverOption = {
  value: string
  label: string
  description?: string
  recommended?: boolean
}

export type TrackingResolverStep = {
  key: string
  label: string
  description?: string
  selectionType: 'single'
  options: TrackingResolverOption[]
}

export type ResolvedTrackingTopic = {
  topicId: string
  name: string
  description?: string
  breadcrumb: Array<{ key: string; label: string }>
  suggestedMaxEvents: number
  workloadMessage: string
  events: Array<{
    eventDefinitionId: string
    name: string
    description?: string
    recommended: boolean
    displayOrder: number
    guidance?: string
    requiresLocation: boolean
    benchmarkable: boolean
  }>
}

export type TrackingValidationResult =
  | { ok: true; mode: Exclude<TrackingSetupMode, 'CUSTOM'>; topicId?: string; eventDefinitionIds: string[] }
  | { ok: false; errors: Array<{ field: string; message: string }> }

const scopeLabels: Record<MatchTrackingScope, string> = { PLAYER: 'Player', UNIT: 'Unit', TEAM: 'Whole team' }

export const targetContextLabels: Record<TrackingTargetContext, string> = {
  GOALKEEPER: 'Goalkeeper',
  CENTRE_BACK: 'Centre-back',
  FULL_BACK: 'Full-back',
  WING_BACK: 'Wing-back',
  DEFENSIVE_MIDFIELDER: 'Defensive midfielder',
  CENTRAL_MIDFIELDER: 'Central midfielder',
  ATTACKING_MIDFIELDER: 'Attacking midfielder',
  WIDE_PLAYER: 'Wide player',
  CENTRE_FORWARD: 'Centre-forward',
  GENERAL_OUTFIELD_PLAYER: 'General outfield player',
  GOALKEEPER_UNIT: 'Goalkeeper unit',
  DEFENSIVE_UNIT: 'Defensive unit',
  MIDFIELD_UNIT: 'Midfield unit',
  ATTACKING_UNIT: 'Attacking unit',
  LEFT_SIDE_UNIT: 'Left-side unit',
  RIGHT_SIDE_UNIT: 'Right-side unit',
  BUILD_UP_UNIT: 'Build-up unit',
  PRESSING_UNIT: 'Pressing unit',
  CUSTOM_UNIT: 'Custom unit',
  WHOLE_TEAM: 'Whole team',
}

export const topicPhaseLabels: Record<TrackingTopicPhase, string> = {
  IN_POSSESSION: 'In possession',
  OUT_OF_POSSESSION: 'Out of possession',
  ATTACKING_TRANSITION: 'Attacking transition',
  DEFENSIVE_TRANSITION: 'Defensive transition',
  ATTACKING_SET_PIECES: 'Attacking set pieces',
  DEFENSIVE_SET_PIECES: 'Defensive set pieces',
  GOALKEEPING: 'Goalkeeping',
}

export const focusAreaLabels: Record<TrackingFocusArea, string> = {
  RECEIVING: 'Receiving', PASSING: 'Passing', CARRYING: 'Carrying', LINK_PLAY: 'Link play', MOVEMENT: 'Movement', CREATING_CHANCES: 'Creating chances', FINISHING: 'Finishing', PRESSING: 'Pressing', DEFENDING: 'Defending', AERIAL_PLAY: 'Aerial play', BALL_RETENTION: 'Ball retention', SHAPE_AND_COMPACTNESS: 'Shape and compactness', COVER_AND_BALANCE: 'Cover and balance', PLAYING_OUT: 'Playing out', PROGRESSION: 'Progression', PROTECTING_SPACE_BEHIND: 'Protecting space behind', DEFENDING_WIDE_AREAS: 'Defending wide areas', DEFENDING_CROSSES: 'Defending crosses', COMBINATION_PLAY: 'Combination play', SUPPORTING_THE_BALL: 'Supporting the ball', BUILD_UP: 'Build-up', POSSESSION: 'Possession', TERRITORY: 'Territory', ATTACKING_TRANSITION: 'Attacking transition', DEFENSIVE_TRANSITION: 'Defensive transition', SET_PIECES: 'Set pieces', REST_DEFENCE: 'Rest defence', GOALKEEPER_DISTRIBUTION: 'Goalkeeper distribution',
}

const playerContexts: TrackingTargetContext[] = ['GOALKEEPER', 'CENTRE_BACK', 'FULL_BACK', 'WING_BACK', 'DEFENSIVE_MIDFIELDER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER', 'WIDE_PLAYER', 'CENTRE_FORWARD', 'GENERAL_OUTFIELD_PLAYER']
const unitContexts: TrackingTargetContext[] = ['GOALKEEPER_UNIT', 'DEFENSIVE_UNIT', 'MIDFIELD_UNIT', 'ATTACKING_UNIT', 'LEFT_SIDE_UNIT', 'RIGHT_SIDE_UNIT', 'BUILD_UP_UNIT', 'PRESSING_UNIT', 'CUSTOM_UNIT']

export function normalizeTrackingSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

export function createTrackingSlug(value: string) {
  return normalizeTrackingSearch(value).replace(/\s+/g, '-') || 'topic'
}

export function mapTopicPhaseToEventDefinitionPhases(phase: TrackingTopicPhase): EventDefinitionMatchPhase[] {
  if (phase === 'ATTACKING_TRANSITION' || phase === 'DEFENSIVE_TRANSITION') return ['TRANSITION']
  if (phase === 'ATTACKING_SET_PIECES' || phase === 'DEFENSIVE_SET_PIECES') return ['SET_PIECES']
  if (phase === 'GOALKEEPING') return ['IN_POSSESSION', 'OUT_OF_POSSESSION']
  return [phase]
}

function getEffectiveTargetContext(context: TrackingResolverContext) {
  if (context.scope === 'PLAYER') return context.targetContext ?? context.playerRole ?? null
  if (context.scope === 'UNIT') return context.targetContext ?? context.unitType ?? 'CUSTOM_UNIT'
  if (context.scope === 'TEAM') return 'WHOLE_TEAM'
  return context.targetContext ?? null
}

function topicWhere(context: TrackingResolverContext): Prisma.EventTopicWhereInput {
  const targetContext = getEffectiveTargetContext(context)
  return {
    isActive: true,
    archivedAt: null,
    OR: [{ ownerScope: 'GLOBAL' }, ...(context.clubId ? [{ ownerScope: 'CLUB' as const, clubId: context.clubId }] : [])],
    ...(context.phase ? { phase: context.phase } : {}),
    ...(context.focusArea ? { focusArea: context.focusArea } : {}),
    ...(context.agePhase ? { agePhases: { has: context.agePhase } } : {}),
    ...(context.scope ? { contexts: { some: { scopeType: context.scope, OR: [{ targetContext }, { targetContext: null }] } } } : {}),
  }
}

async function findTopics(db: Db, context: TrackingResolverContext) {
  return db.eventTopic.findMany({
    where: topicWhere(context),
    include: { contexts: true, aliases: true },
    orderBy: [{ phase: 'asc' }, { focusArea: 'asc' }, { name: 'asc' }],
  })
}

function contextRank(topic: Awaited<ReturnType<typeof findTopics>>[number], context: TrackingResolverContext) {
  const targetContext = getEffectiveTargetContext(context)
  const matches = topic.contexts.filter((candidate) => !context.scope || candidate.scopeType === context.scope)
  const exact = matches.find((candidate) => candidate.targetContext === targetContext)
  const general = matches.find((candidate) => candidate.targetContext === null)
  const row = exact ?? general ?? matches[0]
  return { recommended: row?.recommended ?? false, displayOrder: row?.displayOrder ?? 9999, exact: Boolean(exact) }
}

export function getAvailableTrackingScopes(): TrackingResolverStep {
  return { key: 'scope', label: 'Who are you tracking?', selectionType: 'single', options: (['PLAYER', 'UNIT', 'TEAM'] as MatchTrackingScope[]).map((value) => ({ value, label: scopeLabels[value], recommended: true })) }
}

export function getAvailableTargetContexts(context: TrackingResolverContext): TrackingResolverStep | null {
  if (context.scope === 'TEAM') return null
  if (context.scope === 'PLAYER') return { key: 'targetContext', label: 'Player role', description: 'Choose the role for this match, not just the squad position.', selectionType: 'single', options: playerContexts.map((value) => ({ value, label: targetContextLabels[value], recommended: value === 'GENERAL_OUTFIELD_PLAYER' })) }
  if (context.scope === 'UNIT') return { key: 'targetContext', label: 'Unit type', selectionType: 'single', options: unitContexts.map((value) => ({ value, label: targetContextLabels[value], recommended: ['DEFENSIVE_UNIT', 'MIDFIELD_UNIT', 'ATTACKING_UNIT'].includes(value) })) }
  return null
}

export async function getAvailablePhases(context: TrackingResolverContext, db: Db = prisma): Promise<TrackingResolverStep> {
  const topics = await findTopics(db, context)
  const values = Array.from(new Set(topics.map((topic) => topic.phase)))
  return { key: 'phase', label: 'Phase of play', selectionType: 'single', options: values.map((value) => ({ value, label: topicPhaseLabels[value], recommended: true })) }
}

export async function getAvailableFocusAreas(context: TrackingResolverContext, db: Db = prisma): Promise<TrackingResolverStep> {
  const topics = await findTopics(db, context)
  const values = Array.from(new Set(topics.map((topic) => topic.focusArea)))
  return { key: 'focusArea', label: context.scope === 'TEAM' ? 'Team principle' : context.scope === 'UNIT' ? 'Tactical principle' : 'Focus area', selectionType: 'single', options: values.map((value) => ({ value, label: focusAreaLabels[value], recommended: true })) }
}

export async function getAvailableTopics(context: TrackingResolverContext, db: Db = prisma): Promise<TrackingResolverStep & { noResultsReason?: string }> {
  const topics = await findTopics(db, context)
  const sorted = topics.sort((a, b) => {
    const first = contextRank(a, context)
    const second = contextRank(b, context)
    return Number(second.recommended) - Number(first.recommended) || Number(second.exact) - Number(first.exact) || first.displayOrder - second.displayOrder || a.name.localeCompare(b.name)
  })
  return { key: 'topicId', label: 'Coaching topic', selectionType: 'single', noResultsReason: sorted.length === 0 ? 'No standard topics match this tracking context yet.' : undefined, options: sorted.map((topic) => ({ value: topic.id, label: topic.name, description: topic.description ?? undefined, recommended: contextRank(topic, context).recommended })) }
}

export async function getRecommendedEventsForTopic(topicId: string, context: TrackingResolverContext = {}, db: Db = prisma): Promise<ResolvedTrackingTopic | null> {
  const topic = await db.eventTopic.findFirst({
    where: { id: topicId, ...topicWhere({ ...context, topicId: undefined }) },
    include: { events: { include: { eventDefinition: true }, orderBy: [{ displayOrder: 'asc' }] }, contexts: true },
  })
  if (!topic) return null
  const events = topic.events.filter((event) => event.eventDefinition.isActive && !event.eventDefinition.archivedAt)
  return {
    topicId: topic.id,
    name: topic.name,
    description: topic.description ?? undefined,
    breadcrumb: [
      ...(context.scope ? [{ key: 'scope', label: scopeLabels[context.scope] }] : []),
      ...(getEffectiveTargetContext(context) ? [{ key: 'targetContext', label: targetContextLabels[getEffectiveTargetContext(context)!] }] : []),
      { key: 'phase', label: topicPhaseLabels[topic.phase] },
      { key: 'focusArea', label: focusAreaLabels[topic.focusArea] },
      { key: 'topic', label: topic.name },
    ],
    suggestedMaxEvents: topic.suggestedMaxEvents,
    workloadMessage: `Recommended: ${events.filter((event) => event.recommended).length} events. Tracking more than ${topic.suggestedMaxEvents + 2} events may be difficult for one observer.`,
    events: events.map((event) => ({ eventDefinitionId: event.eventDefinitionId, name: event.eventDefinition.name, description: event.eventDefinition.description ?? undefined, recommended: event.recommended, displayOrder: event.displayOrder, guidance: event.guidance ?? undefined, requiresLocation: event.eventDefinition.requiresLocation, benchmarkable: event.eventDefinition.benchmarkable })),
  }
}

export async function searchTrackingTopics(query: string, context: TrackingResolverContext = {}, db: Db = prisma) {
  const normalized = normalizeTrackingSearch(query)
  if (!normalized) return []
  const topics = await db.eventTopic.findMany({
    where: { AND: [topicWhere(context), { OR: [{ normalizedName: { contains: normalized, mode: 'insensitive' } }, { aliases: { some: { normalizedAlias: { contains: normalized, mode: 'insensitive' } } } }] }] },
    include: { contexts: true, aliases: true },
    take: 20,
  })
  return topics.map((topic) => ({ topicId: topic.id, name: topic.name, description: topic.description ?? undefined, matchedAliases: topic.aliases.filter((alias) => alias.normalizedAlias.includes(normalized)).map((alias) => alias.alias), recommended: contextRank(topic, context).recommended }))
}

export async function getNextTrackingQuestion(context: TrackingResolverContext, db: Db = prisma): Promise<TrackingResolverStep | null> {
  if (!context.scope) return getAvailableTrackingScopes()
  if (context.scope !== 'TEAM' && !getEffectiveTargetContext(context)) return getAvailableTargetContexts(context)
  if (!context.phase) return getAvailablePhases(context, db)
  if (!context.focusArea) return getAvailableFocusAreas(context, db)
  if (!context.topicId) return getAvailableTopics(context, db)
  return null
}

export async function resolveTrackingSetup(context: TrackingResolverContext, db: Db = prisma) {
  if (!context.topicId) return { nextStep: await getNextTrackingQuestion(context, db), topic: null }
  return { nextStep: await getNextTrackingQuestion(context, db), topic: await getRecommendedEventsForTopic(context.topicId, context, db) }
}

export async function getAdvancedCompatibleEvents(context: TrackingResolverContext, db: Db = prisma) {
  const topic = context.topicId ? await getRecommendedEventsForTopic(context.topicId, context, db) : null
  const topicEventIds = new Set(topic?.events.map((event) => event.eventDefinitionId) ?? [])
  const definitions = await db.eventDefinition.findMany({
    where: { isActive: true, archivedAt: null, OR: [{ scope: 'GLOBAL' }, ...(context.clubId ? [{ scope: 'CLUB' as const, clubId: context.clubId }] : [])], ...(context.phase ? { matchPhase: { in: mapTopicPhaseToEventDefinitionPhases(context.phase) } } : {}) },
    orderBy: [{ enabledByDefault: 'desc' }, { matchDayGroup: 'asc' }, { name: 'asc' }],
  })
  return definitions.map((event) => ({ eventDefinitionId: event.id, name: event.name, description: event.description ?? undefined, requiresLocation: event.requiresLocation, benchmarkable: event.benchmarkable, recommendedByTopic: topicEventIds.has(event.id), outsideChosenTopic: Boolean(context.topicId && !topicEventIds.has(event.id)) }))
}

export async function validateTrackingSetup(context: TrackingResolverContext, db: Db = prisma): Promise<TrackingValidationResult> {
  const errors: Array<{ field: string; message: string }> = []
  if (!context.scope) errors.push({ field: 'scope', message: 'Choose a tracking scope.' })
  if (context.scope === 'PLAYER' && !getEffectiveTargetContext(context)) errors.push({ field: 'targetContext', message: 'Choose a player role.' })
  if (context.scope === 'UNIT' && !getEffectiveTargetContext(context)) errors.push({ field: 'targetContext', message: 'Choose a unit type.' })
  if (!context.phase) errors.push({ field: 'phase', message: 'Choose a phase of play.' })
  if (!context.focusArea) errors.push({ field: 'focusArea', message: 'Choose a focus area.' })
  if (!context.selectedEventDefinitionIds?.length) errors.push({ field: 'eventDefinitionIds', message: 'Choose at least one event.' })
  if (context.mode === 'CUSTOM') errors.push({ field: 'mode', message: 'Custom tracking setups are not supported in this phase.' })
  if (errors.length > 0) return { ok: false, errors }

  const mode = context.mode === 'STANDARD_ADVANCED' ? 'STANDARD_ADVANCED' : 'STANDARD_GUIDED'
  if (mode === 'STANDARD_GUIDED' && !context.topicId) return { ok: false, errors: [{ field: 'topicId', message: 'Choose a standard topic.' }] }
  const compatibleEvents = await getAdvancedCompatibleEvents(context, db)
  const compatibleIds = new Set(compatibleEvents.map((event) => event.eventDefinitionId))
  const selectedIds = Array.from(new Set(context.selectedEventDefinitionIds ?? []))
  const invalidEventId = selectedIds.find((id) => !compatibleIds.has(id))
  if (invalidEventId) errors.push({ field: 'eventDefinitionIds', message: 'One or more selected events are not compatible or accessible.' })
  if (mode === 'STANDARD_GUIDED') {
    const topic = await getRecommendedEventsForTopic(context.topicId!, context, db)
    if (!topic) errors.push({ field: 'topicId', message: 'Topic is not compatible with this context.' })
    else {
      const topicEventIds = new Set(topic.events.map((event) => event.eventDefinitionId))
      if (selectedIds.some((id) => !topicEventIds.has(id))) errors.push({ field: 'eventDefinitionIds', message: 'Guided setup events must belong to the selected topic.' })
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, mode, topicId: context.topicId, eventDefinitionIds: selectedIds }
}

export async function reconcileTrackingSelections(previous: TrackingResolverContext, next: TrackingResolverContext, db: Db = prisma) {
  const preserved: TrackingResolverContext = { ...previous, ...next }
  const invalidated: string[] = []
  if (previous.scope !== preserved.scope) {
    delete preserved.targetContext; delete preserved.playerRole; delete preserved.unitType; delete preserved.phase; delete preserved.focusArea; delete preserved.topicId; delete preserved.selectedEventDefinitionIds
    invalidated.push('targetContext', 'phase', 'focusArea', 'topicId', 'selectedEventDefinitionIds')
  }
  if (previous.targetContext !== preserved.targetContext || previous.playerRole !== preserved.playerRole || previous.unitType !== preserved.unitType) {
    const topics = await findTopics(db, preserved)
    if (preserved.topicId && !topics.some((topic) => topic.id === preserved.topicId)) {
      delete preserved.topicId; delete preserved.selectedEventDefinitionIds
      invalidated.push('topicId', 'selectedEventDefinitionIds')
    }
  }
  if (previous.phase !== preserved.phase || previous.focusArea !== preserved.focusArea) {
    delete preserved.topicId; delete preserved.selectedEventDefinitionIds
    invalidated.push('topicId', 'selectedEventDefinitionIds')
  }
  return { preserved, invalidated: Array.from(new Set(invalidated)), nextStep: await getNextTrackingQuestion(preserved, db) }
}
