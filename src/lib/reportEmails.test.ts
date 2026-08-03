import { describe, expect, it } from 'vitest'

import { buildCompletedMatchReportEmailAttachments } from '@/lib/reportEmails'

const player = { firstName: 'Alex', surname: 'Player', squadNumber: 9 }
const baseMatch = {
  venue: 'HOME',
  opposition: 'Rivals',
  kickoffAt: new Date('2026-08-03T10:00:00Z'),
  ownScore: 2,
  oppositionScore: 1,
  matchType: 'LEAGUE',
  team: { name: 'Demo Team', clubId: 'club-1', club: { name: 'Demo Club', sendMatchReportEmails: true } },
  matchDayPlayers: [{ playerId: 'player-1', squadStatus: 'STARTER', isTracked: true, player, stints: [{ startedAt: new Date('2026-08-03T10:00:00Z'), endedAt: new Date('2026-08-03T10:45:00Z') }] }],
}

const standardEvent = {
  id: 'event-standard',
  half: 'FIRST_HALF',
  matchSecond: 60,
  playerId: 'player-1',
  player,
  eventType: 'PASS_COMPLETE',
  eventDefinitionId: 'event-1',
  eventDefinition: { name: 'Forward pass completed', legacyEventType: 'PASS_COMPLETE', benchmarkable: true },
  standardEventDefinitionIdAtRecording: null,
  standardEventDefinitionAtRecording: null,
  clubTrackingDefinitionId: null,
  clubTrackingDefinition: null,
  clubMappingStatusAtRecording: null,
  clubMappingRevisionAtRecording: null,
  ownScoreAtTime: 0,
  oppositionScoreAtTime: 0,
}

const clubEvent = (overrides: Record<string, unknown>) => ({
  ...standardEvent,
  id: 'event-club',
  eventType: 'PASS_COMPLETE',
  eventDefinitionId: 'event-1',
  standardEventDefinitionIdAtRecording: 'event-1',
  standardEventDefinitionAtRecording: { name: 'Forward pass completed', legacyEventType: 'PASS_COMPLETE', benchmarkable: true },
  clubTrackingDefinitionId: 'club-event-1',
  clubTrackingDefinition: { id: 'club-event-1', name: 'Break the line', kind: 'EVENT_ALIAS' },
  clubMappingStatusAtRecording: 'CLUB_APPROVED',
  clubMappingRevisionAtRecording: 1,
  ...overrides,
})

const patternObservation = {
  id: 'pattern-1',
  half: 'FIRST_HALF',
  matchSecond: 120,
  player,
  patternId: 'pattern-standard-1',
  pattern: { name: 'Third player combination', phase: 'IN_POSSESSION', focusArea: 'PASSING', outcomes: [{ positive: true }, { positive: false }] },
  outcome: { label: 'Lost', positive: false },
  trackingTask: { scopeType: 'UNIT', unitLabel: 'Back four' },
  standardPatternDefinitionIdAtRecording: 'pattern-standard-1',
  standardPatternDefinitionAtRecording: { name: 'Third player combination' },
  clubTrackingDefinitionId: 'club-pattern-1',
  clubTrackingDefinition: { id: 'club-pattern-1', name: 'Bounce and break', kind: 'PATTERN_MAPPED' },
  clubMappingStatusAtRecording: 'CLUB_APPROVED',
  clubMappingRevisionAtRecording: 2,
  ownScoreAtTime: 1,
  oppositionScoreAtTime: 0,
  x: 10,
  y: 20,
}

describe('completed match report email attachments', () => {
  it('uses browser event CSV provenance semantics for email exports', () => {
    const { attachments } = buildCompletedMatchReportEmailAttachments({
      ...baseMatch,
      matchEvents: [
        standardEvent,
        clubEvent({ id: 'alias' }),
        clubEvent({ id: 'approved', clubTrackingDefinitionId: 'club-event-approved', clubTrackingDefinition: { id: 'club-event-approved', name: 'Punch pass', kind: 'EVENT_MAPPED' }, clubMappingStatusAtRecording: 'STANDARD_APPROVED' }),
        clubEvent({ id: 'club-only', eventDefinitionId: null, eventType: null, clubTrackingDefinitionId: 'club-event-only', clubTrackingDefinition: { id: 'club-event-only', name: 'Line breaker', kind: 'EVENT_MAPPED' }, clubMappingStatusAtRecording: 'CLUB_APPROVED' }),
        clubEvent({ id: 'rejected', eventDefinitionId: null, eventType: null, clubTrackingDefinitionId: 'club-event-rejected', clubTrackingDefinition: { id: 'club-event-rejected', name: 'Rejected line breaker', kind: 'EVENT_MAPPED' }, clubMappingStatusAtRecording: 'REJECTED' }),
        clubEvent({ id: 'custom', eventDefinitionId: null, eventType: null, standardEventDefinitionIdAtRecording: null, standardEventDefinitionAtRecording: null, clubTrackingDefinitionId: 'club-event-custom', clubTrackingDefinition: { id: 'club-event-custom', name: 'Lock the six', kind: 'EVENT_CUSTOM' }, clubMappingStatusAtRecording: 'NONE' }),
      ],
      patternObservations: [],
    })
    const eventCsv = attachments.find((attachment) => attachment.filename.startsWith('match-events-'))?.content ?? ''

    expect(attachments.map((attachment) => attachment.filename)).toHaveLength(2)
    expect(eventCsv.split('\n')[0].split(',').slice(-13)).toEqual(['Reporting Dimension', 'Club Tracking Definition', 'Club Tracking Definition ID', 'Club Tracking Definition Kind', 'Observation Identity Type', 'Recorded Standard Event', 'Recorded Standard Event ID', 'Proposed Standard Event', 'Proposed Standard Event ID', 'Mapping Status At Recording', 'Mapping Revision At Recording', 'Standard Reporting Eligible', 'Benchmark Eligible'])
    expect(eventCsv).toContain('Standard; Club')
    expect(eventCsv).toContain('Club mapped - standard approved')
    expect(eventCsv).toContain('Club mapped - club only')
    expect(eventCsv).toContain('Club specific')
    expect(eventCsv).toContain('Proposed Standard Event')
    expect(eventCsv).toContain('No')
  })

  it('attaches pattern CSV only when official pattern observations exist', () => {
    const withoutPatterns = buildCompletedMatchReportEmailAttachments({ ...baseMatch, matchEvents: [], patternObservations: [] })
    const withPatterns = buildCompletedMatchReportEmailAttachments({ ...baseMatch, matchEvents: [], patternObservations: [patternObservation] })
    const patternCsv = withPatterns.attachments.find((attachment) => attachment.filename.startsWith('match-pattern-observations-'))?.content ?? ''

    expect(withoutPatterns.attachments.some((attachment) => attachment.filename.startsWith('match-pattern-observations-'))).toBe(false)
    expect(patternCsv).toContain('Bounce and break')
    expect(patternCsv).toContain('Third player combination')
    expect(patternCsv).toContain('Club mapped - club only')
    expect(patternCsv).toContain('UNIT')
    expect(patternCsv).toContain('Back four')
    expect(patternCsv).toContain('10,20')
  })
})
