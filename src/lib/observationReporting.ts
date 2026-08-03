import type {
  ClubTrackingDefinitionKind,
  ClubTrackingMappingStatus,
  MatchTrackingScope,
} from '@prisma/client'

import { observationContributesToStandardReporting } from '@/lib/clubTrackingDefinitions'

export type ObservationIdentityType =
  | 'STANDARD'
  | 'CLUB_ALIAS'
  | 'CLUB_MAPPED_STANDARD_APPROVED'
  | 'CLUB_MAPPED_CLUB_ONLY'
  | 'CLUB_SPECIFIC'

export type ReportingIdentityValue =
  | { type: 'EVENT'; id: string; label: string }
  | { type: 'PATTERN'; id: string; label: string }

export type ObservationReportingIdentity = {
  identityType: ObservationIdentityType
  contributesToStandardReporting: boolean
  contributesToClubReporting: boolean
  benchmarkEligible: boolean
  standardIdentity: ReportingIdentityValue | null
  proposedStandardIdentity: ReportingIdentityValue | null
  clubIdentity: {
    id: string
    label: string
    kind: ClubTrackingDefinitionKind
  } | null
  mappingStatusAtRecording: ClubTrackingMappingStatus | null
  mappingRevisionAtRecording: number | null
}

export type ObservationReportingInput = {
  observationType: 'EVENT' | 'PATTERN'
  eventDefinitionId?: string | null
  eventDefinitionLabel?: string | null
  eventDefinitionBenchmarkable?: boolean | null
  patternId?: string | null
  patternLabel?: string | null
  clubTrackingDefinitionId?: string | null
  clubDefinitionKind?: ClubTrackingDefinitionKind | null
  clubDefinitionLabel?: string | null
  standardEventDefinitionIdAtRecording?: string | null
  standardEventDefinitionLabelAtRecording?: string | null
  standardEventDefinitionBenchmarkableAtRecording?: boolean | null
  standardPatternDefinitionIdAtRecording?: string | null
  standardPatternDefinitionLabelAtRecording?: string | null
  clubMappingStatusAtRecording?: ClubTrackingMappingStatus | null
  clubMappingRevisionAtRecording?: number | null
}

export type ClubMappingSnapshotBreakdown = {
  mappingStatusAtRecording: ClubTrackingMappingStatus | null
  mappingRevisionAtRecording: number | null
  count: number
}

export type ResolvedEventObservation<T> = T & { reportingIdentity: ObservationReportingIdentity }
export type ResolvedPatternObservation<T> = T & { reportingIdentity: ObservationReportingIdentity }

export type StandardEventAggregate = {
  key: string
  standardEventDefinitionId: string
  label: string
  count: number
}

export type StandardPatternAggregate = {
  key: string
  standardPatternDefinitionId: string
  label: string
  count: number
  positiveCount: number
  positiveRate: number | null
  outcomeCounts: Record<string, number>
}

export type ClubEventAggregate = {
  key: string
  clubTrackingDefinitionId: string
  label: string
  definitionKind: ClubTrackingDefinitionKind | null
  identityTypes: ObservationIdentityType[]
  count: number
  standardReportableCount: number
  clubOnlyCount: number
  playerCount: number
  unitTargetCount: number
  teamTargetCount: number
  locationCount: number
  recordedStandardIdentities: ReportingIdentityValue[]
  proposedStandardIdentities: ReportingIdentityValue[]
  mappingSnapshots: ClubMappingSnapshotBreakdown[]
}

export type ClubPatternAggregate = {
  key: string
  clubTrackingDefinitionId: string
  label: string
  definitionKind: ClubTrackingDefinitionKind | null
  identityTypes: ObservationIdentityType[]
  count: number
  standardReportableCount: number
  clubOnlyCount: number
  positiveCount: number
  positiveRate: number | null
  outcomeCounts: Record<string, number>
  outcomePercentages: Record<string, number>
  scopeCounts: Record<string, number>
  targetCounts: Record<string, number>
  locationCount: number
  recordedStandardIdentities: ReportingIdentityValue[]
  proposedStandardIdentities: ReportingIdentityValue[]
  mappingSnapshots: ClubMappingSnapshotBreakdown[]
}

export type MappingCoverageRow = {
  key: ObservationIdentityType | 'REJECTED_MAPPING_AT_RECORDING'
  label: string
  count: number
  percentage: number
}

export function resolveObservationReportingIdentity(input: ObservationReportingInput): ObservationReportingIdentity {
  const isClub = Boolean(input.clubTrackingDefinitionId)
  const kind = input.clubDefinitionKind ?? null
  const contributesToStandardReporting = observationContributesToStandardReporting({
    clubTrackingDefinitionId: input.clubTrackingDefinitionId,
    clubDefinitionKind: kind,
    mappingStatusAtRecording: input.clubMappingStatusAtRecording,
    eventDefinitionId: input.eventDefinitionId ?? input.standardEventDefinitionIdAtRecording,
    patternId: input.patternId ?? input.standardPatternDefinitionIdAtRecording,
  })
  const contributesToClubReporting = isClub
  const identityType = getObservationIdentityType({
    isClub,
    kind,
    mappingStatusAtRecording: input.clubMappingStatusAtRecording ?? null,
  })
  const standardIdentity = contributesToStandardReporting
    ? getAuthoritativeStandardIdentity(input)
    : null
  const proposedStandardIdentity = !standardIdentity ? getProposedStandardIdentity(input) : null
  const clubIdentity = input.clubTrackingDefinitionId
    ? {
        id: input.clubTrackingDefinitionId,
        label: input.clubDefinitionLabel ?? 'Unavailable club definition',
        kind: kind ?? (input.observationType === 'PATTERN' ? 'PATTERN_MAPPED' : 'EVENT_CUSTOM'),
      }
    : null
  const benchmarkEligible = input.observationType === 'EVENT' && Boolean(
    standardIdentity &&
    contributesToStandardReporting &&
    (isClub
      ? input.standardEventDefinitionBenchmarkableAtRecording
      : input.eventDefinitionBenchmarkable)
  )

  return {
    identityType,
    contributesToStandardReporting: Boolean(standardIdentity && contributesToStandardReporting),
    contributesToClubReporting,
    benchmarkEligible,
    standardIdentity,
    proposedStandardIdentity,
    clubIdentity,
    mappingStatusAtRecording: input.clubMappingStatusAtRecording ?? null,
    mappingRevisionAtRecording: input.clubMappingRevisionAtRecording ?? null,
  }
}

export function resolveEventObservation<T extends ObservationReportingInput & { observationType: 'EVENT' }>(event: T): ResolvedEventObservation<T> {
  return { ...event, reportingIdentity: resolveObservationReportingIdentity(event) }
}

export function resolvePatternObservation<T extends ObservationReportingInput & { observationType: 'PATTERN' }>(observation: T): ResolvedPatternObservation<T> {
  return { ...observation, reportingIdentity: resolveObservationReportingIdentity(observation) }
}

export function getStandardReportingKey(identity: ObservationReportingIdentity) {
  if (!identity.contributesToStandardReporting || !identity.standardIdentity) return null
  return `standard-${identity.standardIdentity.type.toLowerCase()}:${identity.standardIdentity.id}`
}

export function aggregateStandardEvents<T extends { reportingIdentity: ObservationReportingIdentity }>(events: T[]): StandardEventAggregate[] {
  const rows = new Map<string, StandardEventAggregate>()
  for (const event of events) {
    const identity = event.reportingIdentity.standardIdentity
    if (!event.reportingIdentity.contributesToStandardReporting || !identity || identity.type !== 'EVENT') continue
    const key = `standard-event:${identity.id}`
    const row = rows.get(key) ?? { key, standardEventDefinitionId: identity.id, label: identity.label, count: 0 }
    row.count += 1
    rows.set(key, row)
  }
  return Array.from(rows.values())
}

export function aggregateStandardPatterns<T extends { reportingIdentity: ObservationReportingIdentity; outcome: { label: string; positive: boolean | null }; pattern?: { outcomes?: Array<{ positive: boolean | null }> } }>(observations: T[]): StandardPatternAggregate[] {
  const rows = new Map<string, StandardPatternAggregate & { hasDefinedPositiveOutcome: boolean }>()
  for (const observation of observations) {
    const identity = observation.reportingIdentity.standardIdentity
    if (!observation.reportingIdentity.contributesToStandardReporting || !identity || identity.type !== 'PATTERN') continue
    const key = `standard-pattern:${identity.id}`
    const row = rows.get(key) ?? { key, standardPatternDefinitionId: identity.id, label: identity.label, count: 0, positiveCount: 0, positiveRate: null, outcomeCounts: {}, hasDefinedPositiveOutcome: false }
    row.count += 1
    if (observation.outcome.positive === true) row.positiveCount += 1
    row.hasDefinedPositiveOutcome = row.hasDefinedPositiveOutcome || hasDefinedPositiveOutcome(observation)
    row.outcomeCounts[observation.outcome.label] = (row.outcomeCounts[observation.outcome.label] ?? 0) + 1
    rows.set(key, row)
  }
  return Array.from(rows.values()).map(({ hasDefinedPositiveOutcome, ...row }) => ({ ...row, positiveRate: getPositiveRate(row.count, row.positiveCount, hasDefinedPositiveOutcome) }))
}

export function aggregateClubEvents<T extends {
  playerId?: string | null
  x?: number | null
  y?: number | null
  reportingIdentity: ObservationReportingIdentity
  targetScope?: MatchTrackingScope | string | null
}>(events: T[]): ClubEventAggregate[] {
  const rows = new Map<string, ClubEventAggregate & { playerIds: Set<string>; identityTypeSet: Set<ObservationIdentityType> }>()
  for (const event of events) {
    const clubIdentity = event.reportingIdentity.clubIdentity
    if (!clubIdentity) continue
    const key = `club-definition:${clubIdentity.id}`
    const row = rows.get(key) ?? {
      key,
      clubTrackingDefinitionId: clubIdentity.id,
      label: clubIdentity.label,
      definitionKind: clubIdentity.kind,
      identityTypes: [],
      identityTypeSet: new Set<ObservationIdentityType>(),
      count: 0,
      standardReportableCount: 0,
      clubOnlyCount: 0,
      playerCount: 0,
      playerIds: new Set<string>(),
      unitTargetCount: 0,
      teamTargetCount: 0,
      locationCount: 0,
      recordedStandardIdentities: [],
      proposedStandardIdentities: [],
      mappingSnapshots: [],
    }
    row.count += 1
    if (event.reportingIdentity.contributesToStandardReporting) row.standardReportableCount += 1
    else row.clubOnlyCount += 1
    if (event.playerId) row.playerIds.add(event.playerId)
    if (event.targetScope === 'UNIT') row.unitTargetCount += 1
    if (event.targetScope === 'TEAM') row.teamTargetCount += 1
    if (typeof event.x === 'number' && typeof event.y === 'number') row.locationCount += 1
    row.identityTypeSet.add(event.reportingIdentity.identityType)
    addUniqueIdentity(row.recordedStandardIdentities, event.reportingIdentity.standardIdentity)
    addUniqueIdentity(row.proposedStandardIdentities, event.reportingIdentity.proposedStandardIdentity)
    addSnapshot(row.mappingSnapshots, event.reportingIdentity)
    rows.set(key, row)
  }
  return Array.from(rows.values()).map(({ playerIds, identityTypeSet, ...row }) => ({
    ...row,
    playerCount: playerIds.size,
    identityTypes: Array.from(identityTypeSet),
  }))
}

export function aggregateClubPatterns<T extends {
  x?: number | null
  y?: number | null
  outcome: { label: string; positive: boolean | null }
  pattern?: { outcomes?: Array<{ positive: boolean | null }> }
  reportingIdentity: ObservationReportingIdentity
  targetScope?: MatchTrackingScope | string | null
  targetLabel?: string | null
}>(observations: T[]): ClubPatternAggregate[] {
  const rows = new Map<string, ClubPatternAggregate & { identityTypeSet: Set<ObservationIdentityType>; hasDefinedPositiveOutcome: boolean }>()
  for (const observation of observations) {
    const clubIdentity = observation.reportingIdentity.clubIdentity
    if (!clubIdentity) continue
    const key = `club-definition:${clubIdentity.id}`
    const row = rows.get(key) ?? {
      key,
      clubTrackingDefinitionId: clubIdentity.id,
      label: clubIdentity.label,
      definitionKind: clubIdentity.kind,
      identityTypes: [],
      identityTypeSet: new Set<ObservationIdentityType>(),
      count: 0,
      standardReportableCount: 0,
      clubOnlyCount: 0,
      positiveCount: 0,
      positiveRate: null,
      outcomeCounts: {},
      outcomePercentages: {},
      scopeCounts: {},
      targetCounts: {},
      locationCount: 0,
      recordedStandardIdentities: [],
      proposedStandardIdentities: [],
      mappingSnapshots: [],
      hasDefinedPositiveOutcome: false,
    }
    row.count += 1
    if (observation.reportingIdentity.contributesToStandardReporting) row.standardReportableCount += 1
    else row.clubOnlyCount += 1
    if (observation.outcome.positive === true) row.positiveCount += 1
    row.hasDefinedPositiveOutcome = row.hasDefinedPositiveOutcome || hasDefinedPositiveOutcome(observation)
    row.outcomeCounts[observation.outcome.label] = (row.outcomeCounts[observation.outcome.label] ?? 0) + 1
    if (observation.targetScope) row.scopeCounts[String(observation.targetScope)] = (row.scopeCounts[String(observation.targetScope)] ?? 0) + 1
    if (observation.targetLabel) row.targetCounts[observation.targetLabel] = (row.targetCounts[observation.targetLabel] ?? 0) + 1
    if (typeof observation.x === 'number' && typeof observation.y === 'number') row.locationCount += 1
    row.identityTypeSet.add(observation.reportingIdentity.identityType)
    addUniqueIdentity(row.recordedStandardIdentities, observation.reportingIdentity.standardIdentity)
    addUniqueIdentity(row.proposedStandardIdentities, observation.reportingIdentity.proposedStandardIdentity)
    addSnapshot(row.mappingSnapshots, observation.reportingIdentity)
    rows.set(key, row)
  }
  return Array.from(rows.values()).map(({ identityTypeSet, hasDefinedPositiveOutcome, ...row }) => ({
    ...row,
    identityTypes: Array.from(identityTypeSet),
    positiveRate: getPositiveRate(row.count, row.positiveCount, hasDefinedPositiveOutcome),
    outcomePercentages: Object.fromEntries(Object.entries(row.outcomeCounts).map(([outcome, count]) => [outcome, count / row.count])),
  }))
}

export function getPositiveRate(total: number, positiveCount: number, hasDefinedPositiveOutcome: boolean) {
  if (total === 0) return null
  if (!hasDefinedPositiveOutcome) return null
  return positiveCount / total
}

function hasDefinedPositiveOutcome(observation: { outcome: { positive: boolean | null }; pattern?: { outcomes?: Array<{ positive: boolean | null }> } }) {
  return observation.outcome.positive === true || Boolean(observation.pattern?.outcomes?.some((outcome) => outcome.positive === true))
}

export function buildMappingCoverage(identities: ObservationReportingIdentity[]): MappingCoverageRow[] {
  const clubIdentities = identities.filter((identity) => identity.contributesToClubReporting)
  const total = clubIdentities.length
  const counts = new Map<MappingCoverageRow['key'], number>()
  for (const identity of clubIdentities) {
    counts.set(identity.identityType, (counts.get(identity.identityType) ?? 0) + 1)
    if (identity.mappingStatusAtRecording === 'REJECTED') {
      counts.set('REJECTED_MAPPING_AT_RECORDING', (counts.get('REJECTED_MAPPING_AT_RECORDING') ?? 0) + 1)
    }
  }
  return Array.from(counts.entries()).map(([key, count]) => ({
    key,
    label: getCoverageLabel(key),
    count,
    percentage: total > 0 ? count / total : 0,
  }))
}

export function getObservationIdentityLabel(identityType: ObservationIdentityType) {
  if (identityType === 'CLUB_ALIAS') return 'Club alias'
  if (identityType === 'CLUB_MAPPED_STANDARD_APPROVED') return 'Club mapped - standard approved'
  if (identityType === 'CLUB_MAPPED_CLUB_ONLY') return 'Club mapped - club only'
  if (identityType === 'CLUB_SPECIFIC') return 'Club specific'
  return 'Standard'
}

function getObservationIdentityType(input: {
  isClub: boolean
  kind: ClubTrackingDefinitionKind | null
  mappingStatusAtRecording: ClubTrackingMappingStatus | null
}): ObservationIdentityType {
  if (!input.isClub) return 'STANDARD'
  if (input.kind === 'EVENT_ALIAS' || input.kind === 'PATTERN_ALIAS') return 'CLUB_ALIAS'
  if (input.kind === 'EVENT_MAPPED' || input.kind === 'PATTERN_MAPPED') {
    return input.mappingStatusAtRecording === 'STANDARD_APPROVED'
      ? 'CLUB_MAPPED_STANDARD_APPROVED'
      : 'CLUB_MAPPED_CLUB_ONLY'
  }
  return 'CLUB_SPECIFIC'
}

function getAuthoritativeStandardIdentity(input: ObservationReportingInput): ReportingIdentityValue | null {
  if (input.observationType === 'EVENT') {
    const id = input.clubTrackingDefinitionId
      ? input.standardEventDefinitionIdAtRecording
      : input.eventDefinitionId
    if (!id) return null
    return { type: 'EVENT', id, label: input.standardEventDefinitionLabelAtRecording ?? input.eventDefinitionLabel ?? 'Unknown event' }
  }
  const id = input.clubTrackingDefinitionId
    ? input.standardPatternDefinitionIdAtRecording
    : input.patternId
  if (!id) return null
  return { type: 'PATTERN', id, label: input.standardPatternDefinitionLabelAtRecording ?? input.patternLabel ?? 'Unknown pattern' }
}

function getProposedStandardIdentity(input: ObservationReportingInput): ReportingIdentityValue | null {
  if (input.observationType === 'EVENT') {
    const id = input.standardEventDefinitionIdAtRecording ?? input.eventDefinitionId
    if (!id) return null
    return { type: 'EVENT', id, label: input.standardEventDefinitionLabelAtRecording ?? input.eventDefinitionLabel ?? 'Unknown event' }
  }
  const id = input.standardPatternDefinitionIdAtRecording ?? input.patternId
  if (!id) return null
  return { type: 'PATTERN', id, label: input.standardPatternDefinitionLabelAtRecording ?? input.patternLabel ?? 'Unknown pattern' }
}

function addUniqueIdentity(target: ReportingIdentityValue[], identity: ReportingIdentityValue | null) {
  if (!identity) return
  if (!target.some((candidate) => candidate.type === identity.type && candidate.id === identity.id)) {
    target.push(identity)
  }
}

function addSnapshot(target: ClubMappingSnapshotBreakdown[], identity: ObservationReportingIdentity) {
  const row = target.find((candidate) =>
    candidate.mappingStatusAtRecording === identity.mappingStatusAtRecording &&
    candidate.mappingRevisionAtRecording === identity.mappingRevisionAtRecording
  )
  if (row) row.count += 1
  else target.push({ mappingStatusAtRecording: identity.mappingStatusAtRecording, mappingRevisionAtRecording: identity.mappingRevisionAtRecording, count: 1 })
}

function getCoverageLabel(key: MappingCoverageRow['key']) {
  if (key === 'REJECTED_MAPPING_AT_RECORDING') return 'Rejected mapping at recording'
  return getObservationIdentityLabel(key)
}
