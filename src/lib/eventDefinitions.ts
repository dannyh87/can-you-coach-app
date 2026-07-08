import type { EventDefinition, EventDefinitionMatchDayGroup, MatchEventCategory, MatchEventType } from '@prisma/client'

import {
  getMatchEventPrismaCategory,
  formatMatchEventType,
  isMatchEventType,
  matchEventTaxonomy,
  matchPhaseLabels,
  type EventTaxonomyItem,
  type MatchPhase,
} from '@/lib/matchEventTaxonomy'
import { prisma } from '@/lib/prisma'

const eventDefinitionMatchPhaseLabels = {
  IN_POSSESSION: 'In possession',
  OUT_OF_POSSESSION: 'Out of possession',
  TRANSITION: 'Transition',
  SET_PIECES: 'Set pieces',
  DISCIPLINE: 'Discipline',
} satisfies Record<MatchPhase, string>

const eventDefinitionCategoryLabels: Record<string, string> = {
  PASSING: 'Passing',
  RECEIVING: 'Receiving',
  DRIBBLING_1V1: 'Dribbling / 1v1',
  SHOOTING: 'Shooting',
  DEFENDING: 'Defending',
  GOALKEEPING: 'Goalkeeping',
  DISCIPLINE: 'Discipline',
  INJURIES: 'Injuries',
  OTHER: 'Other',
}

export const matchDayGroupLabels = {
  GOALS_OUTCOMES: 'Goals & Outcomes',
  SHOOTING: 'Shooting',
  PASSING: 'Passing',
  POSSESSION: 'Possession',
  DEFENDING: 'Defending',
  DISCIPLINE: 'Discipline',
  GOALKEEPING: 'Goalkeeping',
  CUSTOM_OTHER: 'Custom / Other',
} satisfies Record<EventDefinitionMatchDayGroup, string>

export const matchDayGroupOptions = Object.entries(matchDayGroupLabels).map(([value, label]) => ({
  value: value as EventDefinitionMatchDayGroup,
  label,
}))

export function getMatchDayGroupLabel(matchDayGroup: EventDefinitionMatchDayGroup | null | undefined) {
  return matchDayGroup ? matchDayGroupLabels[matchDayGroup] : null
}

export type RecordableEventOption = {
  id: string
  legacyEventType: MatchEventType | null
  label: string
  category: string
  categoryLabel: string
  subcategory: string | null
  matchDayGroup: EventDefinitionMatchDayGroup | null
  matchDayGroupLabel: string | null
  description: string | null
  videoUrl: string | null
  matchPhase: MatchPhase
  matchPhaseLabel: string
  agePhases: EventDefinition['agePhases']
  fourCorner: EventDefinition['fourCorner']
  positionRelevance: EventDefinition['positionRelevance']
  requiresLocation: boolean
  enabledByDefault: boolean
  isActive: boolean
}

type EventDisplaySource = {
  eventType?: MatchEventType | null
  eventDefinition?: Pick<EventDefinition, 'name'> | null
}

export function mapEventDefinitionToRecordableOption(
  eventDefinition: EventDefinition
): RecordableEventOption {
  const matchPhase = mapMatchPhase(eventDefinition.matchPhase)

  return {
    id: eventDefinition.id,
    legacyEventType: getLegacyEventType(eventDefinition),
    label: eventDefinition.name,
    category: eventDefinition.category,
    categoryLabel: eventDefinitionCategoryLabels[eventDefinition.category] ?? eventDefinition.category,
    subcategory: eventDefinition.subcategory,
    matchDayGroup: eventDefinition.matchDayGroup,
    matchDayGroupLabel: getMatchDayGroupLabel(eventDefinition.matchDayGroup),
    description: eventDefinition.description,
    videoUrl: eventDefinition.videoUrl,
    matchPhase,
    matchPhaseLabel: eventDefinitionMatchPhaseLabels[matchPhase],
    agePhases: eventDefinition.agePhases,
    fourCorner: eventDefinition.fourCorner,
    positionRelevance: eventDefinition.positionRelevance,
    requiresLocation: getEventRequiresLocation(eventDefinition),
    enabledByDefault: eventDefinition.enabledByDefault,
    isActive: eventDefinition.isActive,
  }
}

export function mapEventDefinitionsToRecordableOptions(
  eventDefinitions: EventDefinition[]
) {
  return eventDefinitions.map(mapEventDefinitionToRecordableOption)
}

export function getEventDisplayName(event: EventDisplaySource) {
  if (event.eventDefinition?.name) return event.eventDefinition.name
  if (event.eventType) return formatMatchEventType(event.eventType)
  return 'Unknown event'
}

export function getEventRequiresLocation(
  eventDefinition: Pick<EventDefinition, 'requiresLocation'>
) {
  return eventDefinition.requiresLocation
}

export function getLegacyEventType(
  eventDefinition: Pick<EventDefinition, 'legacyEventType'>
) {
  return eventDefinition.legacyEventType ?? null
}

export function getMatchDayEventCategoryFallback(
  eventDefinition: Pick<EventDefinition, 'legacyEventType'> & { matchPhase: EventDefinition['matchPhase'] | MatchPhase }
): MatchEventCategory {
  if (eventDefinition.legacyEventType) return getMatchEventPrismaCategory(eventDefinition.legacyEventType)
  if (eventDefinition.matchPhase === 'IN_POSSESSION') return 'IN_POSSESSION'
  if (eventDefinition.matchPhase === 'OUT_OF_POSSESSION') return 'OUT_OF_POSSESSION'
  if (eventDefinition.matchPhase === 'TRANSITION') return 'TRANSITION'
  return 'ATTACKING'
}

export async function getActiveRecordableEventDefinitions({
  legacyOnly = false,
  clubId,
}: {
  legacyOnly?: boolean
  clubId?: string
} = {}) {
  const eventDefinitions = await prisma.eventDefinition.findMany({
    where: {
      OR: [
        { scope: 'GLOBAL' },
        ...(clubId ? [{ scope: 'CLUB' as const, clubId }] : []),
      ],
      isActive: true,
      ...(legacyOnly ? { legacyEventType: { not: null } } : {}),
    },
    orderBy: [
      { scope: 'desc' },
      { matchDayGroup: 'asc' },
      { matchPhase: 'asc' },
      { category: 'asc' },
      { subcategory: 'asc' },
      { name: 'asc' },
    ],
  })

  return mapEventDefinitionsToRecordableOptions(eventDefinitions)
}

export function getRecordableEventPhaseGroups(events: RecordableEventOption[]) {
  return Object.entries(matchPhaseLabels).map(([value, label]) => ({
    value: value as MatchPhase,
    label,
    events: events.filter((event) => event.matchPhase === value),
  }))
}

const mapMatchPhase = (matchPhase: EventDefinition['matchPhase']): MatchPhase => {
  if (matchPhase === 'DISCIPLINE_MATCH_ADMIN') return 'DISCIPLINE'
  return matchPhase
}

const mapEventDefinitionToTaxonomyItem = (
  eventDefinition: EventDefinition & { legacyEventType: NonNullable<EventDefinition['legacyEventType']> }
): EventTaxonomyItem | null => {
  if (!isMatchEventType(eventDefinition.legacyEventType)) return null

  const matchPhase = mapMatchPhase(eventDefinition.matchPhase)

  return {
    value: eventDefinition.legacyEventType,
    label: eventDefinition.name,
    agePhases: eventDefinition.agePhases,
    matchPhase,
    matchPhaseLabel: eventDefinitionMatchPhaseLabels[matchPhase],
    category: eventDefinition.category,
    categoryLabel: eventDefinitionCategoryLabels[eventDefinition.category] ?? eventDefinition.category,
    prismaCategory: getMatchEventPrismaCategory(eventDefinition.legacyEventType),
    fourCorner: eventDefinition.fourCorner,
    positionRelevance: eventDefinition.positionRelevance,
    enabledByDefault: eventDefinition.enabledByDefault,
  }
}

export async function getRecordableMatchEventTaxonomy() {
  const globalLegacyDefinitions = await prisma.eventDefinition.findMany({
    where: {
      scope: 'GLOBAL',
      legacyEventType: { not: null },
    },
    orderBy: [
      { matchPhase: 'asc' },
      { category: 'asc' },
      { name: 'asc' },
    ],
  })

  if (globalLegacyDefinitions.length === 0) return matchEventTaxonomy

  return globalLegacyDefinitions
    .filter((eventDefinition) => eventDefinition.isActive && eventDefinition.legacyEventType !== null)
    .map((eventDefinition) =>
      mapEventDefinitionToTaxonomyItem(
        eventDefinition as EventDefinition & { legacyEventType: NonNullable<EventDefinition['legacyEventType']> }
      )
    )
    .filter((eventDefinition) => eventDefinition !== null)
}

export function getRecommendedRecordableEventTypes(
  events: EventTaxonomyItem[],
  agePhase: EventTaxonomyItem['agePhases'][number] | 'ALL'
) {
  const defaultEvents = events.filter((event) => event.enabledByDefault)
  const matchingEvents = defaultEvents.filter((event) =>
    agePhase === 'ALL' || event.agePhases.includes(agePhase)
  )

  return (matchingEvents.length > 0 ? matchingEvents : defaultEvents).map((event) => event.value)
}

export function getRecordableMatchPhaseGroups(events: EventTaxonomyItem[]) {
  return Object.entries(matchPhaseLabels).map(([value, label]) => ({
    value: value as MatchPhase,
    label,
    events: events.filter((event) => event.matchPhase === value),
  }))
}
