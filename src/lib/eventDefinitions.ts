import type { EventDefinition } from '@prisma/client'

import {
  getMatchEventPrismaCategory,
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
