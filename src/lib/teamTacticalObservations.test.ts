import { describe, expect, it } from 'vitest'

import {
  buildTacticalObservationReport,
  classifyTacticalObservation,
  getTacticalDetailOptions,
  normalizeTacticalObservationName,
} from '@/lib/teamTacticalObservations'

const event = (id: string, name: string, teamSide: 'OUR_TEAM' | 'OPPOSITION' = 'OUR_TEAM', detailCode: string | null = null, tacticalSequenceId: string | null = null) => ({
  id,
  eventDefinitionId: `definition-${normalizeTacticalObservationName(name)}`,
  eventDefinition: { name },
  standardEventDefinitionAtRecording: null,
  eventType: null,
  teamSide,
  detailCode,
  tacticalSequenceId,
})

const selection = (name: string) => ({
  eventDefinitionId: `definition-${normalizeTacticalObservationName(name)}`,
  eventDefinition: { name },
  eventType: null,
})

describe('team tactical observation classification', () => {
  it('keeps pressing effects separate from generic regains', () => {
    expect(classifyTacticalObservation({ name: 'Press triggered regain' })).toEqual([{ key: 'PRESS_TRIGGERED', outcome: 'success', outcomeLabel: 'Regain' }])
    expect(classifyTacticalObservation({ name: 'Ball recovery' })).toEqual([])
  })

  it('exposes optional details only for relevant tactical observations', () => {
    expect(getTacticalDetailOptions('Final-third entry by pass')).toEqual(expect.arrayContaining([{ code: 'LEFT', label: 'Left' }]))
    expect(getTacticalDetailOptions('Press triggered regain')).toEqual([])
  })
})

describe('team tactical observation report', () => {
  it('distinguishes tracked zero, side totals, outcome totals and optional details', () => {
    const report = buildTacticalObservationReport({
      selections: [selection('Second ball won'), selection('Second ball lost'), selection('Final-third entry by pass')],
      events: [
        event('e1', 'Second ball won', 'OUR_TEAM', 'MIDDLE_THIRD'),
        event('e2', 'Second ball lost', 'OPPOSITION', 'ATTACKING_THIRD'),
        event('e3', 'Final-third entry by pass', 'OUR_TEAM', 'LEFT'),
      ],
    })

    expect(report.metrics.find((metric) => metric.key === 'SECOND_BALLS')).toMatchObject({ attempts: 2, successes: 1, failures: 1, ourTeamTotal: 1, oppositionTotal: 1, coverageLabel: 'Tracked observations recorded' })
    expect(report.metrics.find((metric) => metric.key === 'SECOND_BALLS')?.detailBreakdown).toEqual(expect.arrayContaining([{ label: 'Middle third', count: 1 }, { label: 'Attacking third', count: 1 }]))
    expect(report.metrics.find((metric) => metric.key === 'FINAL_THIRD_ENTRIES')).toMatchObject({ attempts: 1, total: 1, successes: null, failures: null })
    expect(report.metrics.find((metric) => metric.key === 'THROW_INS')).toMatchObject({ tracked: false, coverageLabel: 'Not tracked in setup' })
  })

  it('does not publish linked causal measures without explicit sequence links', () => {
    const report = buildTacticalObservationReport({
      selections: [selection('Attack following regain shot')],
      events: [event('e1', 'Attack following regain shot')],
    })

    expect(report.unavailableMeasures.map((measure) => measure.label)).toContain('Regains producing a shot / tracked regains')
  })

  it('allows linked measures section to be hidden once sequence data exists', () => {
    const report = buildTacticalObservationReport({
      selections: [selection('Attack following regain shot')],
      events: [event('e1', 'Attack following regain shot', 'OUR_TEAM', null, 'sequence-1')],
    })

    expect(report.unavailableMeasures).toEqual([])
  })
})
