import type {
  ClubTrackingDefinitionKind,
  ClubTrackingDefinitionStatus,
  ClubTrackingMappingStatus,
  MatchTrackingScope,
} from '@prisma/client'

import {
  getObservationIdentityLabel,
  resolveObservationReportingIdentity,
  type ObservationReportingIdentity,
} from '@/lib/observationReporting'

export type TeamTrendDimension = 'STANDARD' | 'CLUB'
export type TeamTrendItemType = 'EVENT' | 'PATTERN'

export type TeamTrendIdentity =
  | { dimension: 'STANDARD'; itemType: 'EVENT'; standardEventDefinitionId: string }
  | { dimension: 'STANDARD'; itemType: 'PATTERN'; standardPatternDefinitionId: string }
  | { dimension: 'CLUB'; itemType: 'EVENT'; clubTrackingDefinitionId: string }
  | { dimension: 'CLUB'; itemType: 'PATTERN'; clubTrackingDefinitionId: string }

export type TeamTrendOption = {
  key: string
  identity: TeamTrendIdentity
  displayName: string
  secondaryLabel: string | null
  dimension: TeamTrendDimension
  itemType: TeamTrendItemType
  total: number
  benchmarkEligible: boolean
  retired: boolean
}

export type TeamTrendPoint = {
  matchDayId: string
  matchDate: Date
  opponent: string | null
  score: string
  matchType: string
  total: number
  positiveCount: number | null
  positiveRate: number | null
  playerCount: number
  unitCount: number
  teamCount: number
}

export type TeamTrendSeries = {
  identity: TeamTrendIdentity
  displayName: string
  secondaryLabel?: string | null
  dimension: TeamTrendDimension
  itemType: TeamTrendItemType
  points: TeamTrendPoint[]
  total: number
  positiveCount: number | null
  positiveRate: number | null
  outcomeBreakdown?: Array<{ outcomeId: string; outcomeName: string; count: number; positive: boolean }>
  scopeBreakdown?: { player: number; unit: number; team: number }
  mappingBreakdown?: Array<{ mappingStatusAtRecording: ClubTrackingMappingStatus | null; mappingRevisionAtRecording: number | null; count: number }>
  standardReportingEligible: boolean
  benchmarkEligible: boolean
  historicalMappingWarning?: string | null
}

export type TeamTrendMatch = {
  id: string
  kickoffAt: Date
  opposition: string
  ownScore: number
  oppositionScore: number
  matchType: string
  matchEvents: TeamTrendEventObservation[]
  patternObservations: TeamTrendPatternObservation[]
}

export type TeamTrendEventObservation = {
  id: string
  playerId: string | null
  eventType?: string | null
  eventDefinitionId: string | null
  standardEventDefinitionIdAtRecording: string | null
  clubTrackingDefinitionId: string | null
  clubMappingStatusAtRecording: ClubTrackingMappingStatus | null
  clubMappingRevisionAtRecording: number | null
  x?: number | null
  y?: number | null
  eventDefinition: { id?: string; name: string; benchmarkable?: boolean | null } | null
  standardEventDefinitionAtRecording: { id?: string; name: string; benchmarkable?: boolean | null } | null
  clubTrackingDefinition: TrendClubDefinition | null
}

export type TeamTrendPatternObservation = {
  id: string
  playerId: string | null
  patternId: string
  outcomeId: string
  standardPatternDefinitionIdAtRecording: string | null
  clubTrackingDefinitionId: string | null
  clubMappingStatusAtRecording: ClubTrackingMappingStatus | null
  clubMappingRevisionAtRecording: number | null
  x?: number | null
  y?: number | null
  pattern: { id?: string; name: string; outcomes?: Array<{ positive: boolean | null }> }
  standardPatternDefinitionAtRecording: { id?: string; name: string } | null
  outcome: { id: string; label: string; positive: boolean | null }
  player?: { firstName: string; surname: string } | null
  trackingTask: { scopeType: MatchTrackingScope; unitLabel: string | null }
  clubTrackingDefinition: TrendClubDefinition | null
}

export type TrendClubDefinition = {
  id?: string
  name: string
  kind: ClubTrackingDefinitionKind
  status?: ClubTrackingDefinitionStatus | null
  active?: boolean | null
  retiredAt?: Date | null
}

type ResolvedTrendEvent = TeamTrendEventObservation & { reportingIdentity: ObservationReportingIdentity }
type ResolvedTrendPattern = TeamTrendPatternObservation & { reportingIdentity: ObservationReportingIdentity; targetLabel: string }

const standardDimensionKeys = new Set(['standard', 'STANDARD'])
const clubDimensionKeys = new Set(['club', 'CLUB'])

export function encodeTeamTrendIdentity(identity: TeamTrendIdentity) {
  if (identity.dimension === 'STANDARD' && identity.itemType === 'EVENT') return `standard:event:${identity.standardEventDefinitionId}`
  if (identity.dimension === 'STANDARD' && identity.itemType === 'PATTERN') return `standard:pattern:${identity.standardPatternDefinitionId}`
  if (identity.dimension === 'CLUB' && identity.itemType === 'EVENT') return `club:event:${identity.clubTrackingDefinitionId}`
  return `club:pattern:${identity.clubTrackingDefinitionId}`
}

export function decodeTeamTrendIdentity(value?: string | null): TeamTrendIdentity | null {
  if (!value) return null
  const [dimension, itemType, id] = value.split(':')
  if (!id) return null
  if (dimension === 'standard' && itemType === 'event') return { dimension: 'STANDARD', itemType: 'EVENT', standardEventDefinitionId: id }
  if (dimension === 'standard' && itemType === 'pattern') return { dimension: 'STANDARD', itemType: 'PATTERN', standardPatternDefinitionId: id }
  if (dimension === 'club' && itemType === 'event') return { dimension: 'CLUB', itemType: 'EVENT', clubTrackingDefinitionId: id }
  if (dimension === 'club' && itemType === 'pattern') return { dimension: 'CLUB', itemType: 'PATTERN', clubTrackingDefinitionId: id }
  return null
}

export function decodeTeamTrendDimension(value?: string | null, clubEnabled = false): TeamTrendDimension {
  if (value && clubDimensionKeys.has(value) && clubEnabled) return 'CLUB'
  if (value && standardDimensionKeys.has(value)) return 'STANDARD'
  return 'STANDARD'
}

export function getLegacyTeamTrendIdentity(value: string | null | undefined, options: TeamTrendOption[]) {
  if (!value) return null
  const [source, id] = value.split(':')
  if (!id) return null
  if (source === 'definition') return options.find((option) => option.identity.dimension === 'STANDARD' && option.identity.itemType === 'EVENT' && option.identity.standardEventDefinitionId === id)?.identity ?? null
  if (source === 'legacy') return options.find((option) => option.displayName.toLowerCase() === id.toLowerCase())?.identity ?? null
  return null
}

export function buildTeamTrendOptions(matches: TeamTrendMatch[], clubEnabled = false) {
  const resolved = resolveTrendMatches(matches)
  const options = new Map<string, TeamTrendOption>()
  for (const match of resolved) {
    for (const event of match.events) addEventOptions(options, event, clubEnabled)
    for (const observation of match.patterns) addPatternOptions(options, observation, clubEnabled)
  }
  return Array.from(options.values()).sort((first, second) => first.dimension.localeCompare(second.dimension) || first.itemType.localeCompare(second.itemType) || first.displayName.localeCompare(second.displayName))
}

export function buildTeamTrendSeries(matches: TeamTrendMatch[], identity: TeamTrendIdentity): TeamTrendSeries | null {
  const resolved = resolveTrendMatches(matches)
  const option = buildTeamTrendOptions(matches, true).find((candidate) => sameIdentity(candidate.identity, identity))
  if (!option) return null
  const points = resolved.map((match) => buildPoint(match, identity))
  const total = points.reduce((sum, point) => sum + point.total, 0)
  const matchingPatterns = resolved.flatMap((match) => match.patterns.filter((observation) => matchesIdentity(observation.reportingIdentity, identity)))
  const matchingEvents = resolved.flatMap((match) => match.events.filter((event) => matchesIdentity(event.reportingIdentity, identity)))
  const positiveOutcomeDefined = matchingPatterns.some((observation) => observation.outcome.positive === true || observation.pattern.outcomes?.some((outcome) => outcome.positive === true))
  const positiveCount = identity.itemType === 'PATTERN' ? matchingPatterns.filter((observation) => observation.outcome.positive === true).length : null
  const positiveRate = identity.itemType === 'PATTERN' && total > 0 && positiveOutcomeDefined ? (positiveCount ?? 0) / total : null
  const mappingBreakdown = buildMappingBreakdown([...matchingEvents, ...matchingPatterns].map((item) => item.reportingIdentity))
  const standardTargets = new Set([...matchingEvents, ...matchingPatterns].flatMap((item) => item.reportingIdentity.standardIdentity ? [`${item.reportingIdentity.standardIdentity.type}:${item.reportingIdentity.standardIdentity.id}`] : item.reportingIdentity.proposedStandardIdentity ? [`${item.reportingIdentity.proposedStandardIdentity.type}:${item.reportingIdentity.proposedStandardIdentity.id}`] : []))

  return {
    identity,
    displayName: option.displayName,
    secondaryLabel: option.secondaryLabel,
    dimension: identity.dimension,
    itemType: identity.itemType,
    points,
    total,
    positiveCount,
    positiveRate,
    outcomeBreakdown: identity.itemType === 'PATTERN' ? buildOutcomeBreakdown(matchingPatterns) : undefined,
    scopeBreakdown: identity.itemType === 'PATTERN' ? buildScopeBreakdown(matchingPatterns) : undefined,
    mappingBreakdown: mappingBreakdown.length ? mappingBreakdown : undefined,
    standardReportingEligible: identity.dimension === 'STANDARD',
    benchmarkEligible: identity.itemType === 'EVENT' && matchingEvents.some((event) => event.reportingIdentity.benchmarkEligible),
    historicalMappingWarning: identity.dimension === 'CLUB' && standardTargets.size > 1 ? 'This club definition has observations recorded against more than one historical standard mapping.' : null,
  }
}

function resolveTrendMatches(matches: TeamTrendMatch[]) {
  return matches.map((match) => ({
    match,
    events: match.matchEvents.map(resolveTrendEvent),
    patterns: match.patternObservations.map(resolveTrendPattern),
  }))
}

function resolveTrendEvent(event: TeamTrendEventObservation): ResolvedTrendEvent {
  return {
    ...event,
    reportingIdentity: resolveObservationReportingIdentity({
      observationType: 'EVENT',
      eventDefinitionId: event.eventDefinitionId ?? event.eventType ?? null,
      eventDefinitionLabel: event.eventDefinition?.name ?? event.eventType ?? null,
      eventDefinitionBenchmarkable: event.eventDefinition?.benchmarkable ?? false,
      clubTrackingDefinitionId: event.clubTrackingDefinitionId,
      clubDefinitionKind: event.clubTrackingDefinition?.kind ?? null,
      clubDefinitionLabel: event.clubTrackingDefinition?.name ?? null,
      standardEventDefinitionIdAtRecording: event.standardEventDefinitionIdAtRecording,
      standardEventDefinitionLabelAtRecording: event.standardEventDefinitionAtRecording?.name ?? null,
      standardEventDefinitionBenchmarkableAtRecording: event.standardEventDefinitionAtRecording?.benchmarkable ?? false,
      clubMappingStatusAtRecording: event.clubMappingStatusAtRecording,
      clubMappingRevisionAtRecording: event.clubMappingRevisionAtRecording,
    }),
  }
}

function resolveTrendPattern(observation: TeamTrendPatternObservation): ResolvedTrendPattern {
  return {
    ...observation,
    targetLabel: getPatternTargetLabel(observation),
    reportingIdentity: resolveObservationReportingIdentity({
      observationType: 'PATTERN',
      patternId: observation.patternId,
      patternLabel: observation.pattern.name,
      clubTrackingDefinitionId: observation.clubTrackingDefinitionId,
      clubDefinitionKind: observation.clubTrackingDefinition?.kind ?? null,
      clubDefinitionLabel: observation.clubTrackingDefinition?.name ?? null,
      standardPatternDefinitionIdAtRecording: observation.standardPatternDefinitionIdAtRecording,
      standardPatternDefinitionLabelAtRecording: observation.standardPatternDefinitionAtRecording?.name ?? null,
      clubMappingStatusAtRecording: observation.clubMappingStatusAtRecording,
      clubMappingRevisionAtRecording: observation.clubMappingRevisionAtRecording,
    }),
  }
}

function addEventOptions(options: Map<string, TeamTrendOption>, event: ResolvedTrendEvent, clubEnabled: boolean) {
  const identity = event.reportingIdentity.standardIdentity
  if (event.reportingIdentity.contributesToStandardReporting && identity?.type === 'EVENT') {
    addOption(options, {
      key: `standard:event:${identity.id}`,
      identity: { dimension: 'STANDARD', itemType: 'EVENT', standardEventDefinitionId: identity.id },
      displayName: identity.label,
      secondaryLabel: event.reportingIdentity.benchmarkEligible ? 'Benchmark eligible standard event' : 'Standard event',
      dimension: 'STANDARD',
      itemType: 'EVENT',
      total: 1,
      benchmarkEligible: event.reportingIdentity.benchmarkEligible,
      retired: false,
    })
  }
  const clubIdentity = event.reportingIdentity.clubIdentity
  if (clubEnabled && clubIdentity && clubIdentity.kind.startsWith('EVENT')) {
    addOption(options, {
      key: `club:event:${clubIdentity.id}`,
      identity: { dimension: 'CLUB', itemType: 'EVENT', clubTrackingDefinitionId: clubIdentity.id },
      displayName: clubIdentity.label,
      secondaryLabel: getClubSecondaryLabel(event.reportingIdentity),
      dimension: 'CLUB',
      itemType: 'EVENT',
      total: 1,
      benchmarkEligible: false,
      retired: isRetired(event.clubTrackingDefinition),
    })
  }
}

function addPatternOptions(options: Map<string, TeamTrendOption>, observation: ResolvedTrendPattern, clubEnabled: boolean) {
  const identity = observation.reportingIdentity.standardIdentity
  if (observation.reportingIdentity.contributesToStandardReporting && identity?.type === 'PATTERN') {
    addOption(options, {
      key: `standard:pattern:${identity.id}`,
      identity: { dimension: 'STANDARD', itemType: 'PATTERN', standardPatternDefinitionId: identity.id },
      displayName: identity.label,
      secondaryLabel: 'Standard tactical pattern',
      dimension: 'STANDARD',
      itemType: 'PATTERN',
      total: 1,
      benchmarkEligible: false,
      retired: false,
    })
  }
  const clubIdentity = observation.reportingIdentity.clubIdentity
  if (clubEnabled && clubIdentity && clubIdentity.kind.startsWith('PATTERN')) {
    addOption(options, {
      key: `club:pattern:${clubIdentity.id}`,
      identity: { dimension: 'CLUB', itemType: 'PATTERN', clubTrackingDefinitionId: clubIdentity.id },
      displayName: clubIdentity.label,
      secondaryLabel: getClubSecondaryLabel(observation.reportingIdentity),
      dimension: 'CLUB',
      itemType: 'PATTERN',
      total: 1,
      benchmarkEligible: false,
      retired: isRetired(observation.clubTrackingDefinition),
    })
  }
}

function addOption(options: Map<string, TeamTrendOption>, option: TeamTrendOption) {
  const existing = options.get(option.key)
  if (!existing) {
    options.set(option.key, option)
    return
  }
  existing.total += option.total
  existing.benchmarkEligible = existing.benchmarkEligible || option.benchmarkEligible
  existing.retired = existing.retired || option.retired
}

function buildPoint(resolved: ReturnType<typeof resolveTrendMatches>[number], identity: TeamTrendIdentity): TeamTrendPoint {
  const events = resolved.events.filter((event) => matchesIdentity(event.reportingIdentity, identity))
  const patterns = resolved.patterns.filter((observation) => matchesIdentity(observation.reportingIdentity, identity))
  const total = events.length + patterns.length
  const positiveOutcomeDefined = patterns.some((observation) => observation.outcome.positive === true || observation.pattern.outcomes?.some((outcome) => outcome.positive === true))
  const positiveCount = identity.itemType === 'PATTERN' ? patterns.filter((observation) => observation.outcome.positive === true).length : null
  return {
    matchDayId: resolved.match.id,
    matchDate: resolved.match.kickoffAt,
    opponent: resolved.match.opposition,
    score: `${resolved.match.ownScore}-${resolved.match.oppositionScore}`,
    matchType: resolved.match.matchType,
    total,
    positiveCount,
    positiveRate: identity.itemType === 'PATTERN' && total > 0 && positiveOutcomeDefined ? (positiveCount ?? 0) / total : null,
    playerCount: patterns.filter((observation) => observation.trackingTask.scopeType === 'PLAYER').length + events.filter((event) => event.playerId).length,
    unitCount: patterns.filter((observation) => observation.trackingTask.scopeType === 'UNIT').length,
    teamCount: patterns.filter((observation) => observation.trackingTask.scopeType === 'TEAM').length,
  }
}

function matchesIdentity(identity: ObservationReportingIdentity, selected: TeamTrendIdentity) {
  if (selected.dimension === 'STANDARD') {
    const standard = identity.standardIdentity
    if (!identity.contributesToStandardReporting || !standard) return false
    if (selected.itemType === 'EVENT') return standard.type === 'EVENT' && standard.id === selected.standardEventDefinitionId
    return standard.type === 'PATTERN' && standard.id === selected.standardPatternDefinitionId
  }
  const club = identity.clubIdentity
  if (!club) return false
  if (selected.itemType === 'EVENT') return club.kind.startsWith('EVENT') && club.id === selected.clubTrackingDefinitionId
  return club.kind.startsWith('PATTERN') && club.id === selected.clubTrackingDefinitionId
}

function sameIdentity(first: TeamTrendIdentity, second: TeamTrendIdentity) {
  return encodeTeamTrendIdentity(first) === encodeTeamTrendIdentity(second)
}

function buildMappingBreakdown(identities: ObservationReportingIdentity[]) {
  const rows = new Map<string, { mappingStatusAtRecording: ClubTrackingMappingStatus | null; mappingRevisionAtRecording: number | null; count: number }>()
  for (const identity of identities) {
    if (!identity.contributesToClubReporting) continue
    const key = `${identity.mappingStatusAtRecording ?? 'none'}:${identity.mappingRevisionAtRecording ?? 'none'}`
    const row = rows.get(key) ?? { mappingStatusAtRecording: identity.mappingStatusAtRecording, mappingRevisionAtRecording: identity.mappingRevisionAtRecording, count: 0 }
    row.count += 1
    rows.set(key, row)
  }
  return Array.from(rows.values())
}

function buildOutcomeBreakdown(patterns: ResolvedTrendPattern[]) {
  const rows = new Map<string, { outcomeId: string; outcomeName: string; count: number; positive: boolean }>()
  for (const observation of patterns) {
    const row = rows.get(observation.outcomeId) ?? { outcomeId: observation.outcomeId, outcomeName: observation.outcome.label, count: 0, positive: observation.outcome.positive === true }
    row.count += 1
    rows.set(observation.outcomeId, row)
  }
  return Array.from(rows.values())
}

function buildScopeBreakdown(patterns: ResolvedTrendPattern[]) {
  return {
    player: patterns.filter((observation) => observation.trackingTask.scopeType === 'PLAYER').length,
    unit: patterns.filter((observation) => observation.trackingTask.scopeType === 'UNIT').length,
    team: patterns.filter((observation) => observation.trackingTask.scopeType === 'TEAM').length,
  }
}

function getPatternTargetLabel(observation: TeamTrendPatternObservation) {
  if (observation.trackingTask.scopeType === 'PLAYER') return observation.player ? `${observation.player.firstName} ${observation.player.surname}` : 'Selected player'
  if (observation.trackingTask.scopeType === 'UNIT') return observation.trackingTask.unitLabel ?? 'Selected unit'
  return 'Whole team'
}

function getClubSecondaryLabel(identity: ObservationReportingIdentity) {
  const standard = identity.standardIdentity ?? identity.proposedStandardIdentity
  return [getObservationIdentityLabel(identity.identityType), standard ? `${standard.type === 'EVENT' ? 'Standard event' : 'Standard pattern'}: ${standard.label}` : null].filter(Boolean).join(' - ') || null
}

function isRetired(definition: TrendClubDefinition | null) {
  return Boolean(definition && (definition.retiredAt || definition.active === false || definition.status === 'RETIRED'))
}
