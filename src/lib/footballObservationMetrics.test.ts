import { describe, expect, it } from 'vitest'

import {
  buildFootballMetricReport,
  classifyFootballObservation,
  normalizeFootballObservationName,
} from '@/lib/footballObservationMetrics'

const event = (id: string, playerId: string | null, name: string) => ({
  id,
  playerId,
  eventDefinitionId: `definition-${normalizeFootballObservationName(name)}`,
  eventDefinition: { name },
  eventType: null,
})

const selection = (name: string) => ({ eventDefinitionId: `definition-${normalizeFootballObservationName(name)}`, eventDefinition: { name }, eventType: null })

describe('football observation metric classification', () => {
  it('derives overlapping pass totals from one completed action without duplicate events', () => {
    const classifications = classifyFootballObservation({ name: 'Forward pass completed' })
    expect(classifications).toEqual(expect.arrayContaining([
      { key: 'PASSES', outcome: 'success' },
      { key: 'FORWARD_PASSES', outcome: 'success' },
    ]))
    expect(classifications.filter((item) => item.key === 'FORWARD_PASSES')).toHaveLength(1)
  })

  it('does not infer forward-pass classification from final-third entries', () => {
    const classifications = classifyFootballObservation({ name: 'Pass into final third completed' })
    expect(classifications).toEqual(expect.arrayContaining([
      { key: 'PASSES', outcome: 'success' },
      { key: 'FINAL_THIRD_PASSES', outcome: 'success' },
    ]))
    expect(classifications.some((item) => item.key === 'FORWARD_PASSES')).toBe(false)
  })

  it('excludes ambiguous historical definitions from outcome-based comparisons', () => {
    expect(classifyFootballObservation({ name: 'Forward pass' })).toEqual([])
    expect(classifyFootballObservation({ name: 'Cross' })).toEqual([])
    expect(classifyFootballObservation({ name: 'Possession gained' })).toEqual([])
  })

  it('keeps defensive shot blocks separate from attacker shot outcomes', () => {
    expect(classifyFootballObservation({ name: 'Shot blocked' })).toEqual([{ key: 'SHOT_BLOCKS', outcome: 'count' }])
    expect(classifyFootballObservation({ name: 'Shot blocked' }).some((item) => item.key === 'SHOTS')).toBe(false)
  })
})

describe('football observation metric report', () => {
  it('derives attempts and success rate only from mutually exclusive completed/incomplete outcomes', () => {
    const report = buildFootballMetricReport({
      selections: [selection('Forward pass completed'), selection('Forward pass incomplete')],
      events: [event('e1', 'p1', 'Forward pass completed'), event('e2', 'p1', 'Forward pass incomplete'), event('e3', 'p2', 'Forward pass completed')],
      players: [{ playerId: 'p1', playerName: 'Alex One', minutesPlayed: 45 }, { playerId: 'p2', playerName: 'Blake Two', minutesPlayed: 90 }],
    })
    const forward = report.metrics.find((metric) => metric.key === 'FORWARD_PASSES')
    expect(forward).toMatchObject({ attempts: 3, successes: 2, failures: 1, successRate: 2 / 3, coverageLabel: 'Tracked observations recorded' })
    expect(report.leaderboards.find((leaderboard) => leaderboard.key === 'FORWARD_PASSES')?.rows[0]).toMatchObject({ playerName: 'Alex One', value: 2, per90: 4 })
  })

  it('reports successful-only tracking as count-only, not a fabricated attempt rate', () => {
    const report = buildFootballMetricReport({
      selections: [selection('Tackle won')],
      events: [event('e1', 'p1', 'Tackle won')],
      players: [{ playerId: 'p1', playerName: 'Alex One', minutesPlayed: 90 }],
    })
    expect(report.metrics.find((metric) => metric.key === 'TACKLES')).toMatchObject({ attempts: null, successes: 1, failures: 0, successRate: null, coverageLabel: 'Count only; attempts and success percentage unavailable' })
  })

  it('distinguishes not tracked from tracked with zero recorded events', () => {
    const report = buildFootballMetricReport({
      selections: [selection('Interception')],
      events: [],
      players: [{ playerId: 'p1', playerName: 'Alex One', minutesPlayed: null }],
    })
    expect(report.metrics.find((metric) => metric.key === 'INTERCEPTIONS')).toMatchObject({ tracked: true, total: 0, coverageLabel: 'Tracked, zero recorded' })
    expect(report.metrics.find((metric) => metric.key === 'BALL_RECOVERIES')).toMatchObject({ tracked: false, coverageLabel: 'Not tracked in setup' })
  })
})
