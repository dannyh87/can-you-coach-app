import { describe, expect, it } from 'vitest'

import {
  buildTacticalObservationReport,
  classifyTacticalObservation,
  getTacticalDetailOptions,
  normalizeTacticalObservationName,
  resolveTacticalPresetEventIds,
  tacticalPresets,
  teamTacticalEventDefinitions,
} from '@/lib/teamTacticalObservations'
import { MAX_CLASSIC_RECOMMENDED_OBSERVATIONS } from '@/lib/matchDayClassicSetup'

const event = (id: string, name: string, teamSide: 'OUR_TEAM' | 'OPPOSITION' = 'OUR_TEAM', detailCode: string | null = null, tacticalSequenceId: string | null = null, matchSecond = 10) => ({
  id,
  matchDayId: 'match-1',
  half: 'FIRST_HALF',
  matchSecond,
  eventDefinitionId: `definition-${normalizeTacticalObservationName(name)}`,
  eventDefinition: { name },
  standardEventDefinitionAtRecording: null,
  eventType: null,
  teamSide,
  detailCode,
  tacticalSequenceId,
  tacticalSequence: tacticalSequenceId ? { id: tacticalSequenceId, matchDayId: 'match-1', teamSide, sequenceType: 'ATTACK_AFTER_REGAIN', startHalf: 'FIRST_HALF', startMatchSecond: 10, endHalf: 'FIRST_HALF', endMatchSecond: 25, timeWindowSeconds: 15 } : null,
})

const selection = (name: string) => ({
  eventDefinitionId: `definition-${normalizeTacticalObservationName(name)}`,
  eventDefinition: { name },
  eventType: null,
})

const selectableEvents = teamTacticalEventDefinitions.map((definition) => ({ id: `definition-${normalizeTacticalObservationName(definition.name)}`, label: definition.name }))

describe('team tactical observation classification', () => {
  it('keeps pressing effects separate from generic regains', () => {
    expect(classifyTacticalObservation({ name: 'Press triggered regain' })).toEqual([{ key: 'PRESS_TRIGGERED', outcome: 'success', outcomeLabel: 'Regain' }])
    expect(classifyTacticalObservation({ name: 'Ball recovery' })).toEqual([])
  })

  it('exposes optional details only for relevant tactical observations', () => {
    expect(getTacticalDetailOptions('Final-third entry by pass')).toEqual(expect.arrayContaining([{ code: 'LEFT', label: 'Left' }]))
    expect(getTacticalDetailOptions('Press triggered regain')).toEqual([])
  })

  it('classifies every canonical tactical event definition', () => {
    const unclassified = teamTacticalEventDefinitions.filter((definition) => classifyTacticalObservation({ name: definition.name }).length === 0)

    expect(unclassified).toEqual([])
  })

  it('resolves every tactical preset fully within the recommended observation limit', () => {
    const allEvents = [{ id: 'definition-ball-recovery', label: 'Ball recovery' }, ...selectableEvents]

    for (const preset of tacticalPresets) {
      const result = resolveTacticalPresetEventIds(allEvents, preset.key, MAX_CLASSIC_RECOMMENDED_OBSERVATIONS)

      expect(result).toMatchObject({ ok: true })
      if (result.ok) expect(result.eventIds).toHaveLength(preset.eventNames.length)
    }
  })

  it('rejects missing, duplicate and over-limit presets without partial selections', () => {
    expect(resolveTacticalPresetEventIds(selectableEvents, 'counter-attacking', MAX_CLASSIC_RECOMMENDED_OBSERVATIONS)).toMatchObject({ ok: false, reason: expect.stringContaining('Ball recovery') })
    expect(resolveTacticalPresetEventIds([...selectableEvents, { id: 'duplicate', label: 'Press triggered regain' }], 'pressing', MAX_CLASSIC_RECOMMENDED_OBSERVATIONS)).toMatchObject({ ok: false, reason: expect.stringContaining('multiple selectable definitions') })
    expect(resolveTacticalPresetEventIds([{ id: 'a', label: 'Build-up from goalkeeper controlled exit' }], 'playing-out', 1)).toMatchObject({ ok: false, reason: expect.stringContaining('above the 1 event recommended limit') })
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

  it('keeps unrelated linked measures unavailable when only one valid sequence rule has evidence', () => {
    const report = buildTacticalObservationReport({
      selections: [selection('Attack following regain shot')],
      events: [event('e1', 'Press triggered regain', 'OUR_TEAM', null, 'sequence-1', 10), event('e2', 'Attack following regain shot', 'OUR_TEAM', null, 'sequence-1', 18)],
    })

    expect(report.causalMeasures.find((measure) => measure.key === 'REGAINS_TO_SHOTS')).toMatchObject({ numerator: 1, denominator: 1, rate: 1 })
    expect(report.unavailableMeasures.map((measure) => measure.label)).not.toContain('Regains producing a shot / tracked regains')
    expect(report.unavailableMeasures.map((measure) => measure.label)).toContain('Corners producing a shot / tracked corners')
  })

  it('counts each eligible causal start once and keeps starts without successful outcomes in the denominator', () => {
    const sequence = { id: 'sequence-1', matchDayId: 'match-1', teamSide: 'OUR_TEAM' as const, sequenceType: 'ATTACK_AFTER_REGAIN', startHalf: 'FIRST_HALF', startMatchSecond: 10, endHalf: 'FIRST_HALF', endMatchSecond: 25, timeWindowSeconds: 15 }
    const report = buildTacticalObservationReport({
      selections: [selection('Press triggered regain'), selection('Attack following regain shot')],
      events: [
        { ...event('e1', 'Press triggered regain', 'OUR_TEAM', null, 'sequence-1', 10), tacticalSequence: sequence },
        { ...event('e2', 'Attack following regain shot', 'OUR_TEAM', null, 'sequence-1', 14), tacticalSequence: sequence },
        { ...event('e3', 'Attack following regain goal', 'OUR_TEAM', null, 'sequence-1', 16), tacticalSequence: sequence },
        { ...event('e4', 'Press triggered regain', 'OUR_TEAM', null, 'sequence-1', 20), tacticalSequence: sequence },
        { ...event('e5', 'Attack following regain shot', 'OPPOSITION', null, 'sequence-1', 22), tacticalSequence: sequence },
        { ...event('e6', 'Second ball won', 'OUR_TEAM', null, 'sequence-1', 12), tacticalSequence: sequence },
        { ...event('e7', 'Press triggered regain', 'OUR_TEAM', null, 'sequence-1', 30), tacticalSequence: sequence },
      ],
    })

    expect(report.causalMeasures.find((measure) => measure.key === 'REGAINS_TO_SHOTS')).toMatchObject({ numerator: 1, denominator: 2, rate: 0.5 })
  })

  it('keeps valid starts in the denominator while rejecting invalid side relationships or time windows', () => {
    const sequence = { id: 'sequence-1', matchDayId: 'match-1', teamSide: 'OUR_TEAM' as const, sequenceType: 'ATTACK_AFTER_REGAIN', startHalf: 'FIRST_HALF', startMatchSecond: 10, endHalf: 'FIRST_HALF', endMatchSecond: 25, timeWindowSeconds: 15 }
    const report = buildTacticalObservationReport({
      selections: [selection('Attack following regain shot')],
      events: [
        { ...event('e1', 'Press triggered regain', 'OUR_TEAM', null, 'sequence-1', 10), tacticalSequence: sequence },
        { ...event('e2', 'Attack following regain shot', 'OPPOSITION', null, 'sequence-1', 30), tacticalSequence: sequence },
      ],
    })

    expect(report.causalMeasures.find((measure) => measure.key === 'REGAINS_TO_SHOTS')).toMatchObject({ numerator: 0, denominator: 1, rate: 0 })
    expect(report.unavailableMeasures.map((measure) => measure.label)).not.toContain('Regains producing a shot / tracked regains')
  })
})
