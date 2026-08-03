import { describe, expect, it } from 'vitest'

import {
  aggregateClubEvents,
  aggregateClubPatterns,
  aggregateStandardEvents,
  aggregateStandardPatterns,
  buildMappingCoverage,
  resolveObservationReportingIdentity,
} from '@/lib/observationReporting'
import { buildMatchEventsCsv, buildMatchPatternObservationsCsv, type MatchCsvMetadata } from '@/lib/reportCsv'

const standardEvent = {
  observationType: 'EVENT' as const,
  eventDefinitionId: 'event-1',
  eventDefinitionLabel: 'Forward pass completed',
  eventDefinitionBenchmarkable: true,
}

const standardPattern = {
  observationType: 'PATTERN' as const,
  patternId: 'pattern-1',
  patternLabel: 'Third player combination',
}

const eventAlias = {
  observationType: 'EVENT' as const,
  eventDefinitionId: 'event-1',
  eventDefinitionLabel: 'Forward pass completed',
  clubTrackingDefinitionId: 'club-event-alias',
  clubDefinitionKind: 'EVENT_ALIAS' as const,
  clubDefinitionLabel: 'Break the line',
  standardEventDefinitionIdAtRecording: 'event-1',
  standardEventDefinitionLabelAtRecording: 'Forward pass completed',
  standardEventDefinitionBenchmarkableAtRecording: true,
  clubMappingStatusAtRecording: 'CLUB_APPROVED' as const,
  clubMappingRevisionAtRecording: 1,
}

const patternAlias = {
  observationType: 'PATTERN' as const,
  patternId: 'pattern-1',
  patternLabel: 'Third player combination',
  clubTrackingDefinitionId: 'club-pattern-alias',
  clubDefinitionKind: 'PATTERN_ALIAS' as const,
  clubDefinitionLabel: 'Bounce and break',
  standardPatternDefinitionIdAtRecording: 'pattern-1',
  standardPatternDefinitionLabelAtRecording: 'Third player combination',
  clubMappingStatusAtRecording: 'CLUB_APPROVED' as const,
  clubMappingRevisionAtRecording: 2,
}

describe('official observation reporting identity', () => {
  it('resolves native standard event and benchmark eligibility', () => {
    expect(resolveObservationReportingIdentity(standardEvent)).toMatchObject({
      identityType: 'STANDARD',
      contributesToStandardReporting: true,
      contributesToClubReporting: false,
      benchmarkEligible: true,
      standardIdentity: { type: 'EVENT', id: 'event-1' },
      clubIdentity: null,
    })
  })

  it('resolves native standard pattern without benchmark eligibility', () => {
    expect(resolveObservationReportingIdentity(standardPattern)).toMatchObject({
      identityType: 'STANDARD',
      contributesToStandardReporting: true,
      contributesToClubReporting: false,
      benchmarkEligible: false,
      standardIdentity: { type: 'PATTERN', id: 'pattern-1' },
    })
  })

  it('resolves aliases into both reporting dimensions', () => {
    expect(resolveObservationReportingIdentity(eventAlias)).toMatchObject({
      identityType: 'CLUB_ALIAS',
      contributesToStandardReporting: true,
      contributesToClubReporting: true,
      benchmarkEligible: true,
      standardIdentity: { type: 'EVENT', id: 'event-1' },
      clubIdentity: { id: 'club-event-alias', label: 'Break the line' },
    })
    expect(resolveObservationReportingIdentity(patternAlias)).toMatchObject({
      identityType: 'CLUB_ALIAS',
      contributesToStandardReporting: true,
      contributesToClubReporting: true,
      standardIdentity: { type: 'PATTERN', id: 'pattern-1' },
    })
  })

  it('uses recording-time standard approval for mapped definitions', () => {
    expect(resolveObservationReportingIdentity({ ...eventAlias, clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'STANDARD_APPROVED' })).toMatchObject({
      identityType: 'CLUB_MAPPED_STANDARD_APPROVED',
      contributesToStandardReporting: true,
      contributesToClubReporting: true,
    })
    expect(resolveObservationReportingIdentity({ ...eventAlias, clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'CLUB_APPROVED' })).toMatchObject({
      identityType: 'CLUB_MAPPED_CLUB_ONLY',
      contributesToStandardReporting: false,
      contributesToClubReporting: true,
      standardIdentity: null,
      proposedStandardIdentity: { type: 'EVENT', id: 'event-1' },
      benchmarkEligible: false,
    })
    expect(resolveObservationReportingIdentity({ ...patternAlias, clubDefinitionKind: 'PATTERN_MAPPED', clubMappingStatusAtRecording: 'CLUB_APPROVED' })).toMatchObject({
      identityType: 'CLUB_MAPPED_CLUB_ONLY',
      contributesToStandardReporting: false,
      contributesToClubReporting: true,
      standardIdentity: null,
      proposedStandardIdentity: { type: 'PATTERN', id: 'pattern-1' },
    })
  })

  it('resolves rejected mapped and custom events as club-only', () => {
    expect(resolveObservationReportingIdentity({ ...eventAlias, clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'REJECTED' })).toMatchObject({
      identityType: 'CLUB_MAPPED_CLUB_ONLY',
      contributesToStandardReporting: false,
    })
    expect(resolveObservationReportingIdentity({
      observationType: 'EVENT',
      clubTrackingDefinitionId: 'custom-1',
      clubDefinitionKind: 'EVENT_CUSTOM',
      clubDefinitionLabel: 'Lock the six',
      clubMappingStatusAtRecording: 'NONE',
    })).toMatchObject({
      identityType: 'CLUB_SPECIFIC',
      contributesToStandardReporting: false,
      contributesToClubReporting: true,
      standardIdentity: null,
    })
  })

  it('preserves missing club relation fallback', () => {
    expect(resolveObservationReportingIdentity({
      observationType: 'EVENT',
      clubTrackingDefinitionId: 'missing-club',
      clubDefinitionKind: null,
      clubDefinitionLabel: null,
    })).toMatchObject({
      clubIdentity: { id: 'missing-club', label: 'Unavailable club definition' },
    })
  })
})

describe('official observation reporting aggregation', () => {
  it('counts eligible standard events once and excludes club-only observations', () => {
    const events = [
      { id: 'native', reportingIdentity: resolveObservationReportingIdentity(standardEvent) },
      { id: 'alias', reportingIdentity: resolveObservationReportingIdentity(eventAlias) },
      { id: 'approved', reportingIdentity: resolveObservationReportingIdentity({ ...eventAlias, clubTrackingDefinitionId: 'mapped-ok', clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'STANDARD_APPROVED' }) },
      { id: 'club-only', reportingIdentity: resolveObservationReportingIdentity({ ...eventAlias, clubTrackingDefinitionId: 'mapped-only', clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'CLUB_APPROVED' }) },
    ]
    expect(aggregateStandardEvents(events)).toEqual([{ key: 'standard-event:event-1', standardEventDefinitionId: 'event-1', label: 'Forward pass completed', count: 3 }])
  })

  it('excludes club-only mapped patterns despite non-null pattern id', () => {
    const observations = [
      { id: 'native', outcome: { label: 'Retained', positive: true }, reportingIdentity: resolveObservationReportingIdentity(standardPattern) },
      { id: 'alias', outcome: { label: 'Retained', positive: true }, reportingIdentity: resolveObservationReportingIdentity(patternAlias) },
      { id: 'club-only', outcome: { label: 'Lost', positive: false }, reportingIdentity: resolveObservationReportingIdentity({ ...patternAlias, clubTrackingDefinitionId: 'mapped-only', clubDefinitionKind: 'PATTERN_MAPPED', clubMappingStatusAtRecording: 'CLUB_APPROVED' }) },
    ]
    expect(aggregateStandardPatterns(observations)).toMatchObject([{ key: 'standard-pattern:pattern-1', count: 2, positiveCount: 2, outcomeCounts: { Retained: 2 } }])
  })

  it('groups club events by definition with revision and status breakdowns', () => {
    const events = [
      { id: 'alias-1', playerId: 'p1', targetScope: 'PLAYER', x: 10, y: 20, reportingIdentity: resolveObservationReportingIdentity(eventAlias) },
      { id: 'alias-2', playerId: 'p2', targetScope: 'TEAM', x: null, y: null, reportingIdentity: resolveObservationReportingIdentity({ ...eventAlias, clubMappingRevisionAtRecording: 2 }) },
      { id: 'custom', playerId: null, targetScope: 'UNIT', x: 5, y: 5, reportingIdentity: resolveObservationReportingIdentity({ observationType: 'EVENT', clubTrackingDefinitionId: 'custom-1', clubDefinitionKind: 'EVENT_CUSTOM', clubDefinitionLabel: 'Lock the six', clubMappingStatusAtRecording: 'NONE' }) },
    ]
    expect(aggregateClubEvents(events)).toMatchObject([
      { clubTrackingDefinitionId: 'club-event-alias', count: 2, standardReportableCount: 2, playerCount: 2, teamTargetCount: 1, locationCount: 1, mappingSnapshots: [{ count: 1 }, { count: 1 }] },
      { clubTrackingDefinitionId: 'custom-1', count: 1, clubOnlyCount: 1, unitTargetCount: 1, locationCount: 1 },
    ])
  })

  it('groups club patterns without fabricating event totals', () => {
    const observations = [
      { id: 'alias', targetScope: 'PLAYER', targetLabel: 'Alex', x: 1, y: 2, outcome: { label: 'Retained', positive: true }, reportingIdentity: resolveObservationReportingIdentity(patternAlias) },
      { id: 'club-only', targetScope: 'UNIT', targetLabel: 'Back four', x: null, y: null, outcome: { label: 'Lost', positive: false }, reportingIdentity: resolveObservationReportingIdentity({ ...patternAlias, clubTrackingDefinitionId: 'mapped-only', clubDefinitionKind: 'PATTERN_MAPPED', clubMappingStatusAtRecording: 'CLUB_APPROVED' }) },
    ]
    expect(aggregateClubPatterns(observations)).toMatchObject([
      { clubTrackingDefinitionId: 'club-pattern-alias', count: 1, positiveCount: 1, positiveRate: 1, outcomeCounts: { Retained: 1 } },
      { clubTrackingDefinitionId: 'mapped-only', count: 1, positiveCount: 0, positiveRate: null, outcomeCounts: { Lost: 1 } },
    ])
  })

  it('builds mapping coverage percentages for club observations', () => {
    const identities = [
      resolveObservationReportingIdentity(eventAlias),
      resolveObservationReportingIdentity({ ...eventAlias, clubTrackingDefinitionId: 'mapped', clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'STANDARD_APPROVED' }),
      resolveObservationReportingIdentity({ ...eventAlias, clubTrackingDefinitionId: 'rejected', clubDefinitionKind: 'EVENT_MAPPED', clubMappingStatusAtRecording: 'REJECTED' }),
    ]
    expect(buildMappingCoverage(identities)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'CLUB_ALIAS', count: 1, percentage: 1 / 3 }),
      expect.objectContaining({ key: 'CLUB_MAPPED_STANDARD_APPROVED', count: 1, percentage: 1 / 3 }),
      expect.objectContaining({ key: 'CLUB_MAPPED_CLUB_ONLY', count: 1, percentage: 1 / 3 }),
      expect.objectContaining({ key: 'REJECTED_MAPPING_AT_RECORDING', count: 1, percentage: 1 / 3 }),
    ]))
  })
})

describe('match reporting CSV provenance', () => {
  const metadata: MatchCsvMetadata = {
    match: 'Team vs Opposition',
    dateLabel: '03/08/2026',
    dateForFilename: '2026-08-03',
    teamName: 'Team',
    opposition: 'Opposition',
    venue: 'Home',
    matchType: 'League',
    finalScore: '1-0',
  }

  it('preserves event headers and appends provenance fields', () => {
    const csv = buildMatchEventsCsv(metadata, [{
      half: 'First half',
      matchTime: '01:00',
      playerName: 'Alex Coach',
      event: 'Break the line',
      scoreAtTime: '0-0',
      reportingDimension: 'Club',
      clubTrackingDefinition: 'Break the line',
      clubTrackingDefinitionId: 'club-1',
      clubTrackingDefinitionKind: 'EVENT_MAPPED',
      observationIdentityType: 'Club mapped - club only',
      proposedStandardEvent: 'Forward pass completed',
      proposedStandardEventId: 'event-1',
      standardReportingEligible: 'No',
      benchmarkEligible: 'No',
    }])
    const headers = csv.split('\n')[0].split(',')
    expect(headers.slice(0, 12)).toEqual(['Match', 'Date', 'Team', 'Opposition', 'Venue', 'Match Type', 'Final Score', 'Half', 'Match Time', 'Player', 'Event', 'Score At Time'])
    expect(headers.slice(-13)).toEqual(['Reporting Dimension', 'Club Tracking Definition', 'Club Tracking Definition ID', 'Club Tracking Definition Kind', 'Observation Identity Type', 'Recorded Standard Event', 'Recorded Standard Event ID', 'Proposed Standard Event', 'Proposed Standard Event ID', 'Mapping Status At Recording', 'Mapping Revision At Recording', 'Standard Reporting Eligible', 'Benchmark Eligible'])
    expect(csv).toContain('Club mapped - club only')
    expect(csv).toContain('Forward pass completed')
  })

  it('preserves pattern headers and appends provenance fields', () => {
    const csv = buildMatchPatternObservationsCsv(metadata, [{
      observationType: 'Tactical pattern',
      pattern: 'Bounce and break',
      outcome: 'Retained',
      scope: 'PLAYER',
      target: 'Alex Coach',
      playerName: 'Alex Coach',
      unit: '',
      phase: 'IN_POSSESSION',
      focusArea: 'PASSING',
      matchMinute: '02:00',
      scoreAtTime: '0-0',
      locationX: 10,
      locationY: 20,
      reviewStatus: 'ACCEPTED',
      reportingDimension: 'Club',
      clubTrackingDefinition: 'Bounce and break',
      clubTrackingDefinitionId: 'club-pattern-1',
      clubTrackingDefinitionKind: 'PATTERN_MAPPED',
      observationIdentityType: 'Club mapped - club only',
      proposedStandardPattern: 'Third player combination',
      proposedStandardPatternId: 'pattern-1',
      standardReportingEligible: 'No',
    }])
    const headers = csv.split('\n')[0].split(',')
    expect(headers.slice(0, 21)).toEqual(['Match', 'Date', 'Team', 'Opposition', 'Venue', 'Match Type', 'Final Score', 'Observation Type', 'Pattern', 'Outcome', 'Scope', 'Target', 'Player', 'Unit', 'Phase', 'Focus Area', 'Match Minute', 'Score', 'Location X', 'Location Y', 'Review Status'])
    expect(headers.slice(-12)).toEqual(['Reporting Dimension', 'Club Tracking Definition', 'Club Tracking Definition ID', 'Club Tracking Definition Kind', 'Observation Identity Type', 'Recorded Standard Pattern', 'Recorded Standard Pattern ID', 'Proposed Standard Pattern', 'Proposed Standard Pattern ID', 'Mapping Status At Recording', 'Mapping Revision At Recording', 'Standard Reporting Eligible'])
    expect(csv).toContain('Third player combination')
  })
})
