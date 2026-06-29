export type MatchEventTypeValue =
  | 'GOAL'
  | 'ASSIST'
  | 'SHOT_ON_TARGET'
  | 'SHOT_OFF_TARGET'
  | 'PASS_COMPLETE'
  | 'PASS_INCOMPLETE'
  | 'ONE_V_ONE_SUCCESS'
  | 'ONE_V_ONE_UNSUCCESSFUL'
  | 'TOUCH'

export type MatchEventCategoryValue =
  | 'ATTACKING'
  | 'IN_POSSESSION'
  | 'OUT_OF_POSSESSION'
  | 'TRANSITION'

export type AgePhase = 'FOUNDATION' | 'YOUTH' | 'ADULT' | 'ALL'
export type MatchPhase = 'IN_POSSESSION' | 'OUT_OF_POSSESSION' | 'TRANSITION' | 'SET_PIECES' | 'DISCIPLINE'
export type FourCorner = 'TECHNICAL' | 'TACTICAL' | 'PHYSICAL' | 'PSYCHOLOGICAL_SOCIAL'
export type PositionRelevance =
  | 'ALL'
  | 'GOALKEEPER'
  | 'DEFENDER'
  | 'MIDFIELDER'
  | 'FORWARD'
  | 'WIDE_PLAYER'
  | 'CENTRAL_PLAYER'

export type EventTaxonomyItem = {
  value: MatchEventTypeValue
  label: string
  agePhases: AgePhase[]
  matchPhase: MatchPhase
  matchPhaseLabel: string
  category: string
  categoryLabel: string
  prismaCategory: MatchEventCategoryValue
  fourCorner: FourCorner
  positionRelevance: PositionRelevance[]
  enabledByDefault: boolean
}

export const agePhaseLabels: Record<AgePhase, string> = {
  FOUNDATION: 'Foundation',
  YOUTH: 'Youth',
  ADULT: 'Adult / Open Age',
  ALL: 'Suggested defaults',
}

export const matchPhaseLabels: Record<MatchPhase, string> = {
  IN_POSSESSION: 'In possession',
  OUT_OF_POSSESSION: 'Out of possession',
  TRANSITION: 'Transition',
  SET_PIECES: 'Set pieces',
  DISCIPLINE: 'Discipline',
}

export const matchEventTaxonomy: EventTaxonomyItem[] = [
  {
    value: 'GOAL',
    label: 'Goal',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'SHOOTING',
    categoryLabel: 'Shooting',
    prismaCategory: 'ATTACKING',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD'],
    enabledByDefault: true,
  },
  {
    value: 'ASSIST',
    label: 'Assist',
    agePhases: ['YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'CHANCE_CREATION',
    categoryLabel: 'Chance creation',
    prismaCategory: 'ATTACKING',
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'],
    enabledByDefault: true,
  },
  {
    value: 'SHOT_ON_TARGET',
    label: 'Shot on target',
    agePhases: ['YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'SHOOTING',
    categoryLabel: 'Shooting',
    prismaCategory: 'ATTACKING',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
    enabledByDefault: true,
  },
  {
    value: 'SHOT_OFF_TARGET',
    label: 'Shot off target',
    agePhases: ['YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'SHOOTING',
    categoryLabel: 'Shooting',
    prismaCategory: 'ATTACKING',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
    enabledByDefault: true,
  },
  {
    value: 'PASS_COMPLETE',
    label: 'Pass complete',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'PASSING',
    categoryLabel: 'Passing',
    prismaCategory: 'IN_POSSESSION',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    enabledByDefault: true,
  },
  {
    value: 'PASS_INCOMPLETE',
    label: 'Pass incomplete',
    agePhases: ['YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'PASSING',
    categoryLabel: 'Passing',
    prismaCategory: 'IN_POSSESSION',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    enabledByDefault: true,
  },
  {
    value: 'ONE_V_ONE_SUCCESS',
    label: '1v1 success',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'DRIBBLING',
    categoryLabel: 'Dribbling / 1v1',
    prismaCategory: 'IN_POSSESSION',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'WIDE_PLAYER'],
    enabledByDefault: true,
  },
  {
    value: 'ONE_V_ONE_UNSUCCESSFUL',
    label: '1v1 unsuccessful',
    agePhases: ['YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'DRIBBLING',
    categoryLabel: 'Dribbling / 1v1',
    prismaCategory: 'IN_POSSESSION',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'WIDE_PLAYER'],
    enabledByDefault: true,
  },
  {
    value: 'TOUCH',
    label: 'Touch',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: matchPhaseLabels.IN_POSSESSION,
    category: 'RECEIVING',
    categoryLabel: 'Receiving',
    prismaCategory: 'IN_POSSESSION',
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    enabledByDefault: true,
  },
]

export const matchEventDefinitions = matchEventTaxonomy.map((event) => ({
  value: event.value,
  label: event.label,
  category: event.prismaCategory,
}))

export const matchEventCategories = [
  { value: 'ATTACKING', label: 'Attacking' },
  { value: 'IN_POSSESSION', label: 'In possession' },
  { value: 'OUT_OF_POSSESSION', label: 'Out of possession' },
  { value: 'TRANSITION', label: 'Transition' },
] as const satisfies Array<{ value: MatchEventCategoryValue; label: string }>

export const matchEventTypes = matchEventTaxonomy.map((event) => event.value)

export function isMatchEventType(value: string): value is MatchEventTypeValue {
  return matchEventTypes.includes(value as MatchEventTypeValue)
}

export function getMatchEventDefinition(eventType: string) {
  return matchEventTaxonomy.find((event) => event.value === eventType)
}

export function formatMatchEventType(eventType: string) {
  return getMatchEventDefinition(eventType)?.label ?? eventType
}

export function getMatchEventPrismaCategory(eventType: MatchEventTypeValue): MatchEventCategoryValue {
  return getMatchEventDefinition(eventType)?.prismaCategory ?? 'ATTACKING'
}

export function inferAgePhase(ageGroup: string | null | undefined): AgePhase {
  const normalizedAgeGroup = (ageGroup ?? '').toLowerCase()
  const underAgeMatch = normalizedAgeGroup.match(/u\s?(\d{1,2})/)
  const underAge = underAgeMatch ? Number(underAgeMatch[1]) : null

  if (underAge !== null && underAge >= 6 && underAge <= 11) return 'FOUNDATION'
  if (underAge !== null && underAge >= 12 && underAge <= 18) return 'YOUTH'
  if (
    normalizedAgeGroup.includes('adult') ||
    normalizedAgeGroup.includes('open') ||
    normalizedAgeGroup.includes('senior')
  ) {
    return 'ADULT'
  }

  return 'ALL'
}

export function getRecommendedEventTypes(agePhase: AgePhase) {
  const matchingEvents = matchEventTaxonomy.filter((event) =>
    event.enabledByDefault && (agePhase === 'ALL' || event.agePhases.includes(agePhase))
  )

  return (matchingEvents.length > 0 ? matchingEvents : matchEventTaxonomy.filter((event) => event.enabledByDefault))
    .map((event) => event.value)
}

export function getMatchPhaseGroups() {
  return Object.entries(matchPhaseLabels).map(([value, label]) => ({
    value: value as MatchPhase,
    label,
    events: matchEventTaxonomy.filter((event) => event.matchPhase === value),
  }))
}

export function getCategoriesForMatchPhase(matchPhase: MatchPhase) {
  const categories = new Map<string, { value: string; label: string; events: EventTaxonomyItem[] }>()

  for (const event of matchEventTaxonomy.filter((taxonomyEvent) => taxonomyEvent.matchPhase === matchPhase)) {
    const category = categories.get(event.category) ?? {
      value: event.category,
      label: event.categoryLabel,
      events: [],
    }
    category.events.push(event)
    categories.set(event.category, category)
  }

  return Array.from(categories.values())
}
