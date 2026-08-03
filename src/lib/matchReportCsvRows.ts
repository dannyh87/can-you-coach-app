import type { MatchEventType } from '@prisma/client'

import { getEventDisplayName } from '@/lib/eventDefinitions'
import { formatMatchEventType } from '@/lib/matchEventTaxonomy'
import {
  getObservationIdentityLabel,
  resolveObservationReportingIdentity,
  type ObservationReportingIdentity,
} from '@/lib/observationReporting'
import type { MatchEventCsvRow, MatchPatternObservationCsvRow } from '@/lib/reportCsv'

type ReportPlayer = { firstName: string; surname: string } | null
type ReportClubDefinition = { id: string; name: string; kind: string } | null

export type MatchReportEventCsvSource = {
  id: string
  half: string
  matchSecond: number
  playerId?: string | null
  player: ReportPlayer
  eventType: string | null
  eventDefinitionId: string | null
  eventDefinition: { name: string; legacyEventType?: string | null; benchmarkable?: boolean | null } | null
  standardEventDefinitionIdAtRecording: string | null
  standardEventDefinitionAtRecording: { name: string; benchmarkable?: boolean | null } | null
  clubTrackingDefinitionId: string | null
  clubTrackingDefinition: ReportClubDefinition
  clubMappingStatusAtRecording: string | null
  clubMappingRevisionAtRecording: number | null
  ownScoreAtTime: number
  oppositionScoreAtTime: number
}

export type MatchReportPatternCsvSource = {
  id: string
  half?: string
  matchSecond: number
  player: ReportPlayer
  patternId: string
  pattern: {
    name: string
    phase: unknown
    focusArea: unknown
    outcomes?: Array<{ positive: boolean | null }>
  }
  outcome: { label: string; positive?: boolean | null }
  trackingTask: { scopeType: string; unitLabel: string | null }
  standardPatternDefinitionIdAtRecording: string | null
  standardPatternDefinitionAtRecording: { name: string } | null
  clubTrackingDefinitionId: string | null
  clubTrackingDefinition: ReportClubDefinition
  clubMappingStatusAtRecording: string | null
  clubMappingRevisionAtRecording: number | null
  ownScoreAtTime: number
  oppositionScoreAtTime: number
  x: number | null
  y: number | null
}

export type MatchReportResolvedEvent<T extends MatchReportEventCsvSource = MatchReportEventCsvSource> = T & {
  targetScope: 'PLAYER' | 'TEAM'
  reportingIdentity: ObservationReportingIdentity
}

export type MatchReportResolvedPattern<T extends MatchReportPatternCsvSource = MatchReportPatternCsvSource> = T & {
  targetScope: string
  targetLabel: string
  reportingIdentity: ObservationReportingIdentity
}

export const formatReportStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

export const formatReportHalfLabel = (half: string) =>
  half === 'FIRST_HALF' ? 'First half' : 'Second half'

export const formatReportMatchTime = (matchSecond: number) => {
  const minutes = Math.floor(matchSecond / 60)
  const seconds = matchSecond % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function resolveMatchReportEvents<T extends MatchReportEventCsvSource>(events: T[]): MatchReportResolvedEvent<T>[] {
  return events.map((event) => ({
    ...event,
    targetScope: event.playerId ? 'PLAYER' : 'TEAM',
    reportingIdentity: resolveObservationReportingIdentity({
      observationType: 'EVENT',
      eventDefinitionId: event.eventDefinitionId ?? event.eventType,
      eventDefinitionLabel: event.eventDefinition?.name ?? (event.eventType ? formatMatchEventType(event.eventType as never) : null),
      eventDefinitionBenchmarkable: event.eventDefinition?.benchmarkable ?? false,
      clubTrackingDefinitionId: event.clubTrackingDefinitionId,
      clubDefinitionKind: event.clubTrackingDefinition?.kind as never,
      clubDefinitionLabel: event.clubTrackingDefinition?.name ?? null,
      standardEventDefinitionIdAtRecording: event.standardEventDefinitionIdAtRecording,
      standardEventDefinitionLabelAtRecording: event.standardEventDefinitionAtRecording?.name ?? null,
      standardEventDefinitionBenchmarkableAtRecording: event.standardEventDefinitionAtRecording?.benchmarkable ?? false,
      clubMappingStatusAtRecording: event.clubMappingStatusAtRecording as never,
      clubMappingRevisionAtRecording: event.clubMappingRevisionAtRecording,
    }),
  }))
}

export function resolveMatchReportPatterns<T extends MatchReportPatternCsvSource>(observations: T[]): MatchReportResolvedPattern<T>[] {
  return observations.map((observation) => ({
    ...observation,
    targetScope: observation.trackingTask.scopeType,
    targetLabel: getPatternTargetLabel(observation),
    reportingIdentity: resolveObservationReportingIdentity({
      observationType: 'PATTERN',
      patternId: observation.patternId,
      patternLabel: observation.pattern.name,
      clubTrackingDefinitionId: observation.clubTrackingDefinitionId,
      clubDefinitionKind: observation.clubTrackingDefinition?.kind as never,
      clubDefinitionLabel: observation.clubTrackingDefinition?.name ?? null,
      standardPatternDefinitionIdAtRecording: observation.standardPatternDefinitionIdAtRecording,
      standardPatternDefinitionLabelAtRecording: observation.standardPatternDefinitionAtRecording?.name ?? null,
      clubMappingStatusAtRecording: observation.clubMappingStatusAtRecording as never,
      clubMappingRevisionAtRecording: observation.clubMappingRevisionAtRecording,
    }),
  }))
}

export function buildMatchEventCsvRows(events: Array<MatchReportResolvedEvent | MatchReportEventCsvSource>): MatchEventCsvRow[] {
  return events.map((event) => {
    const reportingIdentity = 'reportingIdentity' in event
      ? event.reportingIdentity
      : resolveMatchReportEvents([event])[0].reportingIdentity
    return {
      half: formatReportHalfLabel(event.half),
      matchTime: formatReportMatchTime(event.matchSecond),
      playerName: event.player ? `${event.player.firstName} ${event.player.surname}` : 'Whole team',
      event: getMatchReportEventLabel(event),
      scoreAtTime: `${event.ownScoreAtTime}-${event.oppositionScoreAtTime}`,
      reportingDimension: getReportingDimensionLabel(reportingIdentity),
      clubTrackingDefinition: reportingIdentity.clubIdentity?.label ?? '',
      clubTrackingDefinitionId: reportingIdentity.clubIdentity?.id ?? '',
      clubTrackingDefinitionKind: reportingIdentity.clubIdentity?.kind ?? '',
      observationIdentityType: getObservationIdentityLabel(reportingIdentity.identityType),
      recordedStandardEvent: reportingIdentity.standardIdentity?.type === 'EVENT' ? reportingIdentity.standardIdentity.label : '',
      recordedStandardEventId: reportingIdentity.standardIdentity?.type === 'EVENT' ? reportingIdentity.standardIdentity.id : '',
      proposedStandardEvent: reportingIdentity.proposedStandardIdentity?.type === 'EVENT' ? reportingIdentity.proposedStandardIdentity.label : '',
      proposedStandardEventId: reportingIdentity.proposedStandardIdentity?.type === 'EVENT' ? reportingIdentity.proposedStandardIdentity.id : '',
      mappingStatusAtRecording: reportingIdentity.mappingStatusAtRecording ? formatReportStatus(reportingIdentity.mappingStatusAtRecording) : '',
      mappingRevisionAtRecording: reportingIdentity.mappingRevisionAtRecording !== null ? String(reportingIdentity.mappingRevisionAtRecording) : '',
      standardReportingEligible: reportingIdentity.contributesToStandardReporting ? 'Yes' : 'No',
      benchmarkEligible: reportingIdentity.benchmarkEligible ? 'Yes' : 'No',
    }
  })
}

export function buildMatchPatternCsvRows(observations: Array<MatchReportResolvedPattern | MatchReportPatternCsvSource>): MatchPatternObservationCsvRow[] {
  return observations.map((observation) => {
    const resolved = 'reportingIdentity' in observation
      ? observation
      : resolveMatchReportPatterns([observation])[0]
    return {
      observationType: 'Tactical pattern',
      pattern: resolved.reportingIdentity.clubIdentity?.label ?? resolved.pattern.name,
      outcome: resolved.outcome.label,
      scope: resolved.trackingTask.scopeType,
      target: resolved.targetLabel,
      playerName: resolved.player ? `${resolved.player.firstName} ${resolved.player.surname}` : '',
      unit: resolved.trackingTask.scopeType === 'UNIT' ? resolved.trackingTask.unitLabel ?? '' : '',
      phase: String(resolved.pattern.phase),
      focusArea: String(resolved.pattern.focusArea),
      matchMinute: formatReportMatchTime(resolved.matchSecond),
      scoreAtTime: `${resolved.ownScoreAtTime}-${resolved.oppositionScoreAtTime}`,
      locationX: resolved.x,
      locationY: resolved.y,
      reviewStatus: 'ACCEPTED',
      reportingDimension: getReportingDimensionLabel(resolved.reportingIdentity),
      clubTrackingDefinition: resolved.reportingIdentity.clubIdentity?.label ?? '',
      clubTrackingDefinitionId: resolved.reportingIdentity.clubIdentity?.id ?? '',
      clubTrackingDefinitionKind: resolved.reportingIdentity.clubIdentity?.kind ?? '',
      observationIdentityType: getObservationIdentityLabel(resolved.reportingIdentity.identityType),
      recordedStandardPattern: resolved.reportingIdentity.standardIdentity?.type === 'PATTERN' ? resolved.reportingIdentity.standardIdentity.label : '',
      recordedStandardPatternId: resolved.reportingIdentity.standardIdentity?.type === 'PATTERN' ? resolved.reportingIdentity.standardIdentity.id : '',
      proposedStandardPattern: resolved.reportingIdentity.proposedStandardIdentity?.type === 'PATTERN' ? resolved.reportingIdentity.proposedStandardIdentity.label : '',
      proposedStandardPatternId: resolved.reportingIdentity.proposedStandardIdentity?.type === 'PATTERN' ? resolved.reportingIdentity.proposedStandardIdentity.id : '',
      mappingStatusAtRecording: resolved.reportingIdentity.mappingStatusAtRecording ? formatReportStatus(resolved.reportingIdentity.mappingStatusAtRecording) : '',
      mappingRevisionAtRecording: resolved.reportingIdentity.mappingRevisionAtRecording !== null ? String(resolved.reportingIdentity.mappingRevisionAtRecording) : '',
      standardReportingEligible: resolved.reportingIdentity.contributesToStandardReporting ? 'Yes' : 'No',
    }
  })
}

export function getMatchReportEventLabel(event: Pick<MatchReportEventCsvSource, 'clubTrackingDefinition' | 'eventDefinition' | 'eventType'>) {
  return event.clubTrackingDefinition?.name ?? getEventDisplayName({
    eventDefinition: event.eventDefinition,
    eventType: event.eventType as MatchEventType | null,
  })
}

function getPatternTargetLabel(observation: MatchReportPatternCsvSource) {
  if (observation.trackingTask.scopeType === 'PLAYER') return observation.player ? `${observation.player.firstName} ${observation.player.surname}` : 'Selected player'
  if (observation.trackingTask.scopeType === 'UNIT') return observation.trackingTask.unitLabel ?? 'Selected unit'
  return 'Whole team'
}

function getReportingDimensionLabel(identity: ObservationReportingIdentity) {
  if (identity.contributesToStandardReporting && identity.contributesToClubReporting) return 'Standard; Club'
  return identity.contributesToClubReporting ? 'Club' : 'Standard'
}
