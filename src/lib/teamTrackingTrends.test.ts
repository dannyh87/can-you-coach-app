import { describe, expect, it } from 'vitest'

import {
  buildTeamTrendOptions,
  buildTeamTrendSeries,
  decodeTeamTrendDimension,
  decodeTeamTrendIdentity,
  encodeTeamTrendIdentity,
  getLegacyTeamTrendIdentity,
  type TeamTrendMatch,
} from '@/lib/teamTrackingTrends'

const baseMatch = (overrides: Partial<TeamTrendMatch> = {}): TeamTrendMatch => ({
  id: 'match-1',
  kickoffAt: new Date('2026-08-01T10:00:00Z'),
  opposition: 'Opposition',
  ownScore: 2,
  oppositionScore: 1,
  matchType: 'LEAGUE',
  matchEvents: [],
  patternObservations: [],
  ...overrides,
})

const standardEvent = (id: string, eventDefinitionId = 'event-1') => ({
  id,
  playerId: 'player-1',
  eventType: 'PASS_COMPLETE',
  eventDefinitionId,
  standardEventDefinitionIdAtRecording: null,
  clubTrackingDefinitionId: null,
  clubMappingStatusAtRecording: null,
  clubMappingRevisionAtRecording: null,
  eventDefinition: { id: eventDefinitionId, name: 'Forward pass completed', benchmarkable: true },
  standardEventDefinitionAtRecording: null,
  clubTrackingDefinition: null,
})

const clubEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 'club-event',
  playerId: 'player-2',
  eventType: null,
  eventDefinitionId: 'event-1',
  standardEventDefinitionIdAtRecording: 'event-1',
  clubTrackingDefinitionId: 'club-event-1',
  clubMappingStatusAtRecording: 'CLUB_APPROVED' as const,
  clubMappingRevisionAtRecording: 1,
  eventDefinition: { id: 'event-1', name: 'Forward pass completed', benchmarkable: true },
  standardEventDefinitionAtRecording: { id: 'event-1', name: 'Forward pass completed', benchmarkable: true },
  clubTrackingDefinition: { id: 'club-event-1', name: 'Break the line', kind: 'EVENT_ALIAS' as const, status: 'APPROVED' as const, active: true, retiredAt: null },
  ...overrides,
})

const standardPattern = (id: string, outcomePositive: boolean | null = true) => ({
  id,
  playerId: 'player-1',
  patternId: 'pattern-1',
  outcomeId: outcomePositive === true ? 'outcome-positive' : 'outcome-negative',
  standardPatternDefinitionIdAtRecording: null,
  clubTrackingDefinitionId: null,
  clubMappingStatusAtRecording: null,
  clubMappingRevisionAtRecording: null,
  pattern: { id: 'pattern-1', name: 'Third player combination', outcomes: [{ positive: true }, { positive: false }] },
  standardPatternDefinitionAtRecording: null,
  outcome: { id: outcomePositive === true ? 'outcome-positive' : 'outcome-negative', label: outcomePositive === true ? 'Retained' : 'Lost', positive: outcomePositive },
  player: { firstName: 'Alex', surname: 'Player' },
  trackingTask: { scopeType: 'PLAYER' as const, unitLabel: null },
  clubTrackingDefinition: null,
})

const clubPattern = (overrides: Record<string, unknown> = {}) => ({
  id: 'club-pattern',
  playerId: null,
  patternId: 'pattern-1',
  outcomeId: 'outcome-negative',
  standardPatternDefinitionIdAtRecording: 'pattern-1',
  clubTrackingDefinitionId: 'club-pattern-1',
  clubMappingStatusAtRecording: 'CLUB_APPROVED' as const,
  clubMappingRevisionAtRecording: 1,
  pattern: { id: 'pattern-1', name: 'Third player combination', outcomes: [{ positive: true }, { positive: false }] },
  standardPatternDefinitionAtRecording: { id: 'pattern-1', name: 'Third player combination' },
  outcome: { id: 'outcome-negative', label: 'Lost', positive: false },
  player: null,
  trackingTask: { scopeType: 'UNIT' as const, unitLabel: 'Back four' },
  clubTrackingDefinition: { id: 'club-pattern-1', name: 'Bounce and break', kind: 'PATTERN_MAPPED' as const, status: 'APPROVED' as const, active: true, retiredAt: null },
  ...overrides,
})

describe('team tracking trend typed identities', () => {
  it('encodes and decodes typed identities', () => {
    const identity = { dimension: 'STANDARD' as const, itemType: 'EVENT' as const, standardEventDefinitionId: 'event-1' }
    expect(encodeTeamTrendIdentity(identity)).toBe('standard:event:event-1')
    expect(decodeTeamTrendIdentity('club:pattern:club-pattern-1')).toEqual({ dimension: 'CLUB', itemType: 'PATTERN', clubTrackingDefinitionId: 'club-pattern-1' })
    expect(decodeTeamTrendIdentity('bad')).toBeNull()
  })

  it('falls club dimension back when feature is disabled', () => {
    expect(decodeTeamTrendDimension('club', false)).toBe('STANDARD')
    expect(decodeTeamTrendDimension('club', true)).toBe('CLUB')
  })
})

describe('team tracking trend options', () => {
  it('collapses aliases and approved mapped observations into one standard event option', () => {
    const matches = [baseMatch({ matchEvents: [standardEvent('native'), clubEvent({ id: 'alias' }), clubEvent({ id: 'mapped', clubTrackingDefinitionId: 'club-event-2', clubTrackingDefinition: { id: 'club-event-2', name: 'Punch pass', kind: 'EVENT_MAPPED', status: 'APPROVED', active: true, retiredAt: null }, clubMappingStatusAtRecording: 'STANDARD_APPROVED' })] })]
    const options = buildTeamTrendOptions(matches, true)
    expect(options.filter((option) => option.key === 'standard:event:event-1')).toHaveLength(1)
    expect(options.find((option) => option.key === 'standard:event:event-1')).toMatchObject({ total: 3, benchmarkEligible: true })
    expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'club:event:club-event-1' }), expect.objectContaining({ key: 'club:event:club-event-2' })]))
  })

  it('builds standard and club pattern options while excluding club-only from standard', () => {
    const matches = [baseMatch({ patternObservations: [standardPattern('native'), clubPattern()] })]
    const options = buildTeamTrendOptions(matches, true)
    expect(options.find((option) => option.key === 'standard:pattern:pattern-1')).toMatchObject({ total: 1 })
    expect(options.find((option) => option.key === 'club:pattern:club-pattern-1')).toMatchObject({ total: 1 })
  })

  it('retains legacy event URL compatibility where practical', () => {
    const options = buildTeamTrendOptions([baseMatch({ matchEvents: [standardEvent('native')] })], false)
    expect(getLegacyTeamTrendIdentity('definition:event-1', options)).toEqual({ dimension: 'STANDARD', itemType: 'EVENT', standardEventDefinitionId: 'event-1' })
  })
})

describe('team tracking trend aggregation', () => {
  it('counts standard events once and excludes club-only/custom observations', () => {
    const matches = [baseMatch({ matchEvents: [standardEvent('native'), clubEvent({ id: 'alias' }), clubEvent({ id: 'approved', clubMappingStatusAtRecording: 'STANDARD_APPROVED', clubTrackingDefinitionId: 'approved', clubTrackingDefinition: { id: 'approved', name: 'Punch pass', kind: 'EVENT_MAPPED', status: 'APPROVED', active: true, retiredAt: null } }), clubEvent({ id: 'club-only', clubMappingStatusAtRecording: 'CLUB_APPROVED', clubTrackingDefinitionId: 'club-only', clubTrackingDefinition: { id: 'club-only', name: 'Line breaker', kind: 'EVENT_MAPPED', status: 'APPROVED', active: true, retiredAt: null } }), clubEvent({ id: 'custom', eventDefinitionId: null, standardEventDefinitionIdAtRecording: null, clubTrackingDefinitionId: 'custom', clubTrackingDefinition: { id: 'custom', name: 'Lock the six', kind: 'EVENT_CUSTOM', status: 'APPROVED', active: true, retiredAt: null } })] })]
    const series = buildTeamTrendSeries(matches, { dimension: 'STANDARD', itemType: 'EVENT', standardEventDefinitionId: 'event-1' })
    expect(series).toMatchObject({ total: 3, benchmarkEligible: true })
    expect(series?.points[0].total).toBe(3)
  })

  it('includes all club event statuses and preserves player attribution without fabricating unit/team', () => {
    const event = clubEvent({ clubMappingStatusAtRecording: 'REJECTED', clubMappingRevisionAtRecording: 3, clubTrackingDefinition: { id: 'club-event-1', name: 'Break the line', kind: 'EVENT_MAPPED', status: 'RETIRED', active: false, retiredAt: new Date('2026-08-02') } })
    const series = buildTeamTrendSeries([baseMatch({ matchEvents: [event] })], { dimension: 'CLUB', itemType: 'EVENT', clubTrackingDefinitionId: 'club-event-1' })
    expect(series).toMatchObject({ total: 1, benchmarkEligible: false, mappingBreakdown: [{ mappingStatusAtRecording: 'REJECTED', mappingRevisionAtRecording: 3, count: 1 }] })
    expect(series?.points[0]).toMatchObject({ playerCount: 1, unitCount: 0, teamCount: 0 })
  })

  it('builds standard pattern trends with correct positive rate', () => {
    const series = buildTeamTrendSeries([baseMatch({ patternObservations: [standardPattern('positive', true), standardPattern('negative', false)] })], { dimension: 'STANDARD', itemType: 'PATTERN', standardPatternDefinitionId: 'pattern-1' })
    expect(series).toMatchObject({ total: 2, positiveCount: 1, positiveRate: 0.5, scopeBreakdown: { player: 2, unit: 0, team: 0 } })
    expect(series?.outcomeBreakdown).toEqual(expect.arrayContaining([expect.objectContaining({ outcomeName: 'Retained', count: 1 }), expect.objectContaining({ outcomeName: 'Lost', count: 1 })]))
  })

  it('returns zero positive rate when positives are defined but not observed', () => {
    const series = buildTeamTrendSeries([baseMatch({ patternObservations: [standardPattern('negative', false)] })], { dimension: 'STANDARD', itemType: 'PATTERN', standardPatternDefinitionId: 'pattern-1' })
    expect(series).toMatchObject({ total: 1, positiveCount: 0, positiveRate: 0 })
    expect(series?.points[0]).toMatchObject({ positiveCount: 0, positiveRate: 0 })
  })

  it('returns null positive rate when no positive outcome is defined', () => {
    const observation = standardPattern('neutral', null)
    ;(observation.pattern as { outcomes: Array<{ positive: boolean | null }> }).outcomes = [{ positive: null }]
    const series = buildTeamTrendSeries([baseMatch({ patternObservations: [observation] })], { dimension: 'STANDARD', itemType: 'PATTERN', standardPatternDefinitionId: 'pattern-1' })
    expect(series).toMatchObject({ total: 1, positiveCount: 0, positiveRate: null })
  })

  it('preserves PLAYER UNIT and TEAM counts for club patterns', () => {
    const matches = [baseMatch({ patternObservations: [clubPattern({ id: 'player', trackingTask: { scopeType: 'PLAYER', unitLabel: null }, player: { firstName: 'Alex', surname: 'Player' }, playerId: 'player-1' }), clubPattern({ id: 'unit', trackingTask: { scopeType: 'UNIT', unitLabel: 'Back four' } }), clubPattern({ id: 'team', trackingTask: { scopeType: 'TEAM', unitLabel: null } })] })]
    const series = buildTeamTrendSeries(matches, { dimension: 'CLUB', itemType: 'PATTERN', clubTrackingDefinitionId: 'club-pattern-1' })
    expect(series).toMatchObject({ total: 3, positiveCount: 0, positiveRate: 0, scopeBreakdown: { player: 1, unit: 1, team: 1 } })
    expect(series?.points[0]).toMatchObject({ playerCount: 1, unitCount: 1, teamCount: 1 })
  })

  it('keeps revisions in one club series and warns for multiple historical standards', () => {
    const matches = [baseMatch({ matchEvents: [clubEvent({ id: 'first', standardEventDefinitionIdAtRecording: 'event-1', standardEventDefinitionAtRecording: { id: 'event-1', name: 'Forward pass completed', benchmarkable: true }, clubMappingStatusAtRecording: 'STANDARD_APPROVED', clubMappingRevisionAtRecording: 1 }), clubEvent({ id: 'second', standardEventDefinitionIdAtRecording: 'event-2', standardEventDefinitionAtRecording: { id: 'event-2', name: 'Line break pass', benchmarkable: true }, clubMappingStatusAtRecording: 'STANDARD_APPROVED', clubMappingRevisionAtRecording: 2 })] })]
    const series = buildTeamTrendSeries(matches, { dimension: 'CLUB', itemType: 'EVENT', clubTrackingDefinitionId: 'club-event-1' })
    expect(series).toMatchObject({ total: 2, historicalMappingWarning: expect.stringContaining('more than one historical standard mapping') })
    expect(series?.mappingBreakdown).toHaveLength(2)
  })
})
