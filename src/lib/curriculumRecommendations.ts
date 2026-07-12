export type MatchFormatRecommendation = '3v3' | '5v5' | '7v7' | '9v9' | '11v11' | 'unknown'

export type CurriculumFocus =
  | 'Ball confidence and involvement'
  | 'Passing, receiving and support'
  | 'Attacking and chance creation'
  | 'Defending and transition'
  | 'Playing through thirds'
  | 'Team model and tactical trends'

export type AvailableCurriculumEvent = {
  id: string
  name?: string
  label?: string
  slug?: string | null
  normalizedName?: string | null
  scope?: string
  clubId?: string | null
}

type RecommendationTemplate = {
  title: string
  explanation: string
  eventNames: string[]
}

export const curriculumFocusOptions: CurriculumFocus[] = [
  'Ball confidence and involvement',
  'Passing, receiving and support',
  'Attacking and chance creation',
  'Defending and transition',
  'Playing through thirds',
  'Team model and tactical trends',
]

const weekFocusLabels: Record<number, string> = {
  1: 'Week 1: introduce theme',
  2: 'Week 2: repeat and reinforce',
  3: 'Week 3: add challenge',
  4: 'Week 4: review and compare',
}

const genericTemplate: RecommendationTemplate = {
  title: 'Focused match observation',
  explanation: 'Use a small set of simple events that coaches can realistically record live, then adjust manually for the team context.',
  eventNames: ['Touch', 'Pass complete', 'Pass incomplete', 'Shot on target', 'Shot off target', 'Possession gained', 'Possession lost'],
}

const templates: Record<MatchFormatRecommendation, RecommendationTemplate> = {
  '3v3': {
    title: 'Foundation 3v3/5v5 - Ball Confidence',
    explanation: 'Track simple involvement actions that show whether young players are getting on the ball, travelling with it and trying to win it back.',
    eventNames: ['Touch', 'Carry / dribble', '1v1 attempted', 'Shot', 'Ball won'],
  },
  '5v5': {
    title: 'Foundation 5v5/7v7 - Pass, Move, Attack',
    explanation: 'Keep the picture simple while adding early passing and attacking habits alongside ball confidence.',
    eventNames: ['Touch', 'Carry / dribble', 'Pass attempted', 'Pass completed', '1v1 attempted', 'Shot', 'Ball won'],
  },
  '7v7': {
    title: 'Development 7v7/9v9 - Play Forward & Regain',
    explanation: 'Look for receiving, playing forward, finishing attempts and quick regains without overloading the live recorder.',
    eventNames: ['Touch', 'Receive', 'Carry', 'Pass complete', 'Pass incomplete', 'Forward pass', 'Shot', 'Ball won', 'Interception'],
  },
  '9v9': {
    title: 'Development 7v7/9v9 - Play Forward & Regain',
    explanation: 'Add more unit-based events so coaches can compare how the team progresses, creates and regains possession.',
    eventNames: ['Receive under pressure', 'Forward pass', 'Switch', 'Key pass', 'Cross', 'Shot on target', 'Shot off target', 'Tackle won', 'Interception', 'Possession won', 'Possession lost'],
  },
  '11v11': {
    title: '11v11/Adult - Build, Create, Finish, Defend',
    explanation: 'Use tactical events that support team-model review across build-up, chance creation, transition, set pieces and defending.',
    eventNames: ['Forward pass', 'Line-breaking pass', 'Final-third entry', 'Cross', 'Cutback', 'Shot on target', 'Shot off target', 'Key pass', 'Assist', 'Possession won', 'Possession lost', 'Counter-attack', 'Set-piece chance', 'Block', 'Clearance', 'Goalkeeper save', 'Goalkeeper distribution'],
  },
  unknown: genericTemplate,
}

const eventAliases: Record<string, string[]> = {
  'Carry / dribble': ['Carry', 'Dribble', 'Positive carry', '1v1 success', '1v1 successful', '1v1 attempted'],
  Carry: ['Carry', 'Dribble', 'Positive carry', '1v1 success', '1v1 successful'],
  '1v1 attempted': ['1v1 attempted', '1v1 success', '1v1 successful', '1v1 unsuccessful', 'One v one attempted'],
  Shot: ['Shot', 'Shot on target', 'Shot off target', 'Shot position'],
  'Ball won': ['Ball won', 'Possession won', 'Possession gained', 'Regain'],
  'Possession won': ['Possession won', 'Possession gained', 'Ball won', 'Regain'],
  'Pass attempted': ['Pass attempted', 'Pass complete', 'Pass incomplete'],
  'Pass completed': ['Pass completed', 'Pass complete', 'Successful pass'],
  'Pass complete': ['Pass complete', 'Pass completed', 'Successful pass'],
  Receive: ['Receive', 'Receiving', 'Touch'],
  Cross: ['Cross'],
  Block: ['Shot blocked', 'Block'],
  'Shot blocked': ['Shot blocked', 'Block'],
  'Set-piece chance': ['Set-piece chance', 'Set piece chance', 'Set pieces chance'],
  'Final-third entry': ['Final-third entry', 'Final third entry'],
  'Line-breaking pass': ['Line-breaking pass', 'Line breaking pass'],
  'Counter-attack': ['Counter-attack', 'Counter attack'],
}

const synonymMap: Record<string, string> = {
  completed: 'complete',
  successful: 'complete',
  gained: 'won',
  regain: 'won',
  regains: 'won',
  dribble: 'carry',
  dribbling: 'carry',
  attempted: 'attempt',
  attempts: 'attempt',
  target: 'target',
}

export function inferMatchFormat(ageGroup?: string | null): MatchFormatRecommendation {
  const normalizedAgeGroup = (ageGroup ?? '').toLowerCase()
  const underAgeMatch = normalizedAgeGroup.match(/u\s?(\d{1,2})/)
  const underAge = underAgeMatch ? Number(underAgeMatch[1]) : null

  if (underAge !== null) {
    if (underAge >= 6 && underAge <= 7) return '3v3'
    if (underAge >= 8 && underAge <= 9) return '5v5'
    if (underAge >= 10 && underAge <= 11) return '7v7'
    if (underAge >= 12 && underAge <= 13) return '9v9'
    if (underAge >= 14) return '11v11'
  }

  if (
    normalizedAgeGroup.includes('adult') ||
    normalizedAgeGroup.includes('open') ||
    normalizedAgeGroup.includes('senior') ||
    normalizedAgeGroup.includes('veteran')
  ) {
    return '11v11'
  }

  return 'unknown'
}

export function getDefaultCurriculumFocus(ageGroup?: string | null): CurriculumFocus {
  const matchFormat = inferMatchFormat(ageGroup)
  if (matchFormat === '3v3' || matchFormat === '5v5') return 'Ball confidence and involvement'
  if (matchFormat === '7v7') return 'Passing, receiving and support'
  if (matchFormat === '9v9') return 'Playing through thirds'
  if (matchFormat === '11v11') return 'Team model and tactical trends'
  return 'Ball confidence and involvement'
}

export function getCurriculumRecommendation({
  ageGroup,
  matchFormat,
  focus,
  weekNumber,
  availableEvents,
}: {
  ageGroup?: string | null
  matchFormat?: MatchFormatRecommendation
  focus: CurriculumFocus
  weekNumber: number
  availableEvents: AvailableCurriculumEvent[]
}) {
  const inferredMatchFormat = matchFormat ?? inferMatchFormat(ageGroup)
  const template = templates[inferredMatchFormat] ?? genericTemplate
  const weekFocus = weekFocusLabels[weekNumber] ?? weekFocusLabels[1]
  const matchedEvents: Array<{ id: string; name: string; scope?: string; clubId?: string | null }> = []
  const missingEventNames: string[] = []
  const usedEventIds = new Set<string>()

  for (const recommendedEventName of template.eventNames) {
    const matches = findMatchingEvents(recommendedEventName, availableEvents)
      .filter((event) => !usedEventIds.has(event.id))

    if (matches.length === 0) {
      missingEventNames.push(recommendedEventName)
      continue
    }

    for (const event of matches) {
      usedEventIds.add(event.id)
      matchedEvents.push({
        id: event.id,
        name: getEventName(event),
        scope: event.scope,
        clubId: event.clubId,
      })
    }
  }

  return {
    curriculumTitle: getFocusAdjustedTitle(template.title, focus),
    weekFocus,
    explanation: template.explanation,
    recommendedEventNames: template.eventNames,
    matchedEventDefinitionIds: matchedEvents.map((event) => event.id),
    matchedEvents,
    missingEventNames,
    inferredMatchFormat,
  }
}

function getFocusAdjustedTitle(templateTitle: string, focus: CurriculumFocus) {
  if (templateTitle.includes(' - ')) return `${templateTitle} (${focus})`
  return `${templateTitle} - ${focus}`
}

function findMatchingEvents(recommendedEventName: string, availableEvents: AvailableCurriculumEvent[]) {
  const aliases = [recommendedEventName, ...(eventAliases[recommendedEventName] ?? [])]
  const aliasKeys = new Set(aliases.flatMap((alias) => getComparableKeys(alias)))
  const exactMatches = availableEvents.filter((event) => getEventComparableKeys(event).some((key) => aliasKeys.has(key)))

  if (exactMatches.length > 0) return exactMatches

  return availableEvents.filter((event) => {
    const eventKeys = getEventComparableKeys(event)
    return [...aliasKeys].some((aliasKey) =>
      eventKeys.some((eventKey) => eventKey.includes(aliasKey) || aliasKey.includes(eventKey))
    )
  })
}

function getEventName(event: AvailableCurriculumEvent) {
  return event.name ?? event.label ?? 'Unknown event'
}

function getEventComparableKeys(event: AvailableCurriculumEvent) {
  return [
    getEventName(event),
    event.slug,
    event.normalizedName,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => getComparableKeys(value))
}

function getComparableKeys(value: string) {
  const normalized = normalizeEventName(value)
  const sorted = normalized.split(' ').sort().join(' ')
  return Array.from(new Set([normalized, sorted].filter(Boolean)))
}

function normalizeEventName(value: string) {
  return value
    .toLowerCase()
    .replace(/one\s+v\s+one/g, '1v1')
    .replace(/1\s*v\s*1/g, '1v1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => synonymMap[token] ?? token)
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
    .join(' ')
}
