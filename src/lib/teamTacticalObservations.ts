import { formatMatchEventType } from '@/lib/matchEventTaxonomy'
import type { ObservationReportingIdentity } from '@/lib/observationReporting'
import { tacticalPresets as rawTacticalPresets, teamTacticalEventDefinitions as rawTeamTacticalEventDefinitions } from '@/lib/teamTacticalCatalogue.mjs'

export type TacticalObservationSide = 'OUR_TEAM' | 'OPPOSITION'
type TacticalOutcome = 'success' | 'failure' | 'count'

export type TacticalMetricKey =
  | 'BUILD_UP_FROM_GOALKEEPER'
  | 'ESCAPE_PRESS'
  | 'MIDFIELD_LINE_BREAKS'
  | 'BALLS_BEHIND_DEFENSIVE_LINE'
  | 'FINAL_THIRD_ENTRIES'
  | 'PENALTY_AREA_ENTRIES'
  | 'SWITCHES_OF_PLAY'
  | 'CUTBACKS'
  | 'PRESS_TRIGGERED'
  | 'COUNTER_PRESS_REGAINS'
  | 'ATTACKS_FOLLOWING_REGAIN'
  | 'OPPOSITION_ATTACKS_FOLLOWING_OUR_LOSS'
  | 'SECOND_BALLS'
  | 'OPPOSITION_CENTRAL_PENETRATION'
  | 'ATTACKING_SET_PIECES'
  | 'DEFENDING_SET_PIECES'
  | 'THROW_INS'

export type TacticalMetricDefinition = {
  key: TacticalMetricKey
  label: string
  question: string
  guidance: string
  paired: boolean
}

export type TacticalDetailOption = { code: string; label: string }

export type TacticalPreset = {
  key: string
  label: string
  description: string
  eventNames: string[]
}

export type TacticalPresetResolution =
  | { ok: true; eventIds: string[] }
  | { ok: false; reason: string }

export type TacticalEventSource = {
  id: string
  matchDayId?: string | null
  half?: string | null
  matchSecond?: number | null
  eventType?: string | null
  eventDefinition?: { name?: string | null } | null
  standardEventDefinitionAtRecording?: { name?: string | null } | null
  reportingIdentity?: ObservationReportingIdentity
  teamSide?: TacticalObservationSide | null
  detailCode?: string | null
  tacticalSequenceId?: string | null
  tacticalSequence?: TacticalSequenceSource | null
}

export type TacticalSequenceSource = {
  id: string
  matchDayId?: string | null
  teamSide?: TacticalObservationSide | null
  sequenceType: string
  startHalf: string
  startMatchSecond: number
  endHalf?: string | null
  endMatchSecond?: number | null
  timeWindowSeconds?: number | null
}

export type TacticalSelectionSource = {
  eventType?: string | null
  eventDefinition?: { name?: string | null } | null
}

export type TacticalMetricCount = {
  key: TacticalMetricKey
  label: string
  question: string
  attempts: number | null
  successes: number | null
  failures: number | null
  total: number
  successRate: number | null
  tracked: boolean
  coverageLabel: string
  ourTeamTotal: number
  oppositionTotal: number
  outcomeBreakdown: Array<{ label: string; count: number }>
  detailBreakdown: Array<{ label: string; count: number }>
}

export type TacticalUnavailableMeasure = {
  label: string
  reason: string
}

export type TacticalCausalMeasure = {
  key: string
  label: string
  numerator: number
  denominator: number
  rate: number | null
  coverageLabel: string
}

export type TacticalObservationReport = {
  metrics: TacticalMetricCount[]
  causalMeasures: TacticalCausalMeasure[]
  unavailableMeasures: TacticalUnavailableMeasure[]
}

type TacticalMetricTotalRow = {
  successes: number
  failures: number
  count: number
  ourTeam: number
  opposition: number
  outcomes: Map<string, number>
  details: Map<string, number>
}

const detailOptionsByName = {
  'Break opposition midfield line completed': [
    { code: 'THROUGH', label: 'Through' },
    { code: 'AROUND', label: 'Around' },
    { code: 'OVER', label: 'Over' },
  ],
  'Break opposition midfield line incomplete': [
    { code: 'THROUGH', label: 'Through' },
    { code: 'AROUND', label: 'Around' },
    { code: 'OVER', label: 'Over' },
  ],
  'Final-third entry by pass': [
    { code: 'LEFT', label: 'Left' },
    { code: 'CENTRE', label: 'Centre' },
    { code: 'RIGHT', label: 'Right' },
  ],
  'Final-third entry by carry': [
    { code: 'LEFT', label: 'Left' },
    { code: 'CENTRE', label: 'Centre' },
    { code: 'RIGHT', label: 'Right' },
  ],
  'Second ball won': [
    { code: 'DEFENSIVE_THIRD', label: 'Defensive third' },
    { code: 'MIDDLE_THIRD', label: 'Middle third' },
    { code: 'ATTACKING_THIRD', label: 'Attacking third' },
  ],
  'Second ball lost': [
    { code: 'DEFENSIVE_THIRD', label: 'Defensive third' },
    { code: 'MIDDLE_THIRD', label: 'Middle third' },
    { code: 'ATTACKING_THIRD', label: 'Attacking third' },
  ],
  'Attacking corner routine': [
    { code: 'NEAR_POST', label: 'Near post delivery' },
    { code: 'CENTRAL', label: 'Central delivery' },
    { code: 'FAR_POST', label: 'Far post delivery' },
    { code: 'EDGE_BOX', label: 'Edge of box delivery' },
    { code: 'SHORT', label: 'Short routine' },
  ],
  'Attacking free-kick routine': [
    { code: 'NEAR_POST', label: 'Near post delivery' },
    { code: 'CENTRAL', label: 'Central delivery' },
    { code: 'FAR_POST', label: 'Far post delivery' },
    { code: 'EDGE_BOX', label: 'Edge of box delivery' },
    { code: 'SHORT', label: 'Short routine' },
  ],
  'Defending corner or free kick first contact won': [
    { code: 'NEAR_POST', label: 'Near post zone' },
    { code: 'CENTRAL', label: 'Central zone' },
    { code: 'FAR_POST', label: 'Far post zone' },
    { code: 'EDGE_BOX', label: 'Edge of box zone' },
  ],
  'Defending corner or free kick first contact lost': [
    { code: 'NEAR_POST', label: 'Near post zone' },
    { code: 'CENTRAL', label: 'Central zone' },
    { code: 'FAR_POST', label: 'Far post zone' },
    { code: 'EDGE_BOX', label: 'Edge of box zone' },
  ],
} satisfies Record<string, TacticalDetailOption[]>

export const tacticalPresets = rawTacticalPresets as TacticalPreset[]
export const teamTacticalEventDefinitions = rawTeamTacticalEventDefinitions as Array<{ name: string }>

export const tacticalMetricDefinitions: TacticalMetricDefinition[] = [
  { key: 'BUILD_UP_FROM_GOALKEEPER', label: 'Build-up from goalkeeper', question: 'Are we getting controlled exits from goalkeeper build-up?', guidance: 'Controlled exit means the team moves from goalkeeper restart/build-up into the middle third while retaining controlled possession.', paired: true },
  { key: 'ESCAPE_PRESS', label: 'Escape opposition press', question: 'Are we successfully playing through pressure?', guidance: 'Escaping a press means retaining controlled possession beyond the first pressing unit, not merely clearing the ball away.', paired: true },
  { key: 'MIDFIELD_LINE_BREAKS', label: 'Break opposition midfield line', question: 'Are we breaking the midfield line?', guidance: 'Simplified line break: the ball moves beyond the opposition midfield unit to a teammate or controlled target area. Inspired by provider line-break concepts, not provider compatible.', paired: true },
  { key: 'BALLS_BEHIND_DEFENSIVE_LINE', label: 'Ball behind defensive line', question: 'Are balls in behind reaching useful targets?', guidance: 'A ball intentionally played behind the defensive line. Outcomes separate teammate receipt, opponent win, offside and out of play.', paired: false },
  { key: 'FINAL_THIRD_ENTRIES', label: 'Final-third entries', question: 'Are we entering through the intended areas?', guidance: 'Simplified final-third entry: first controlled entry into the attacking third by pass or carry. Inspired by FIFA EFI language, not official EFI compatibility.', paired: false },
  { key: 'PENALTY_AREA_ENTRIES', label: 'Penalty-area entries', question: 'Are entries into the box controlled?', guidance: 'A pass, carry or cross entering the penalty area. Controlled means our team has the next controlled touch or usable possession.', paired: true },
  { key: 'SWITCHES_OF_PLAY', label: 'Switches of play', question: 'Are we changing the point of attack?', guidance: 'Switch of play means moving the ball from one wide channel/side to the opposite side to change the point of attack.', paired: true },
  { key: 'CUTBACKS', label: 'Cutbacks', question: 'Are wide attacks finding cutbacks?', guidance: 'A cutback is a pass pulled back from the byline or wide channel into a central scoring area.', paired: false },
  { key: 'PRESS_TRIGGERED', label: 'Press triggered', question: 'What does our press cause?', guidance: 'Record the observed press effect. A long ball and a later regain can both be recorded as separate outcomes if both happen.', paired: false },
  { key: 'COUNTER_PRESS_REGAINS', label: 'Counter-press regains', question: 'Are we recovering quickly after losing it?', guidance: 'Our simplified rule: possession recovered within 5 seconds of our loss. The 5-second rule is part of this observation identity.', paired: false },
  { key: 'ATTACKS_FOLLOWING_REGAIN', label: 'Attack following regain', question: 'Are regains producing threat?', guidance: 'Record explicit attacking outcomes after a regain. Do not infer causation from nearby events unless a sequence is linked.', paired: false },
  { key: 'OPPOSITION_ATTACKS_FOLLOWING_OUR_LOSS', label: 'Opposition attack following our loss', question: 'Are we vulnerable immediately after losing possession?', guidance: 'Record explicit opposition outcomes after our loss. Do not infer causation from timing alone.', paired: false },
  { key: 'SECOND_BALLS', label: 'Second balls', question: 'Are we winning second balls?', guidance: 'Second ball means the next contested ball after an aerial challenge, clearance or direct ball where neither team has clear control yet.', paired: true },
  { key: 'OPPOSITION_CENTRAL_PENETRATION', label: 'Opposition central penetration', question: 'Are opponents playing through our centre?', guidance: 'Central penetration means the opponent progresses through the central channel beyond our midfield/defensive screen.', paired: true },
  { key: 'ATTACKING_SET_PIECES', label: 'Attacking set pieces', question: 'Are our set-piece routines improving?', guidance: 'Record routine, first-contact and shot outcomes explicitly. Corners producing a shot need sequence links for exact reporting.', paired: false },
  { key: 'DEFENDING_SET_PIECES', label: 'Defending set pieces', question: 'Are we defending set-piece first and second phases?', guidance: 'Record first contact, second-ball outcome and shot conceded explicitly.', paired: false },
  { key: 'THROW_INS', label: 'Our throw-ins', question: 'Are we retaining possession from throw-ins?', guidance: 'Retained means our team still has controlled possession after the receiving action or the next deliberate team action within 5 seconds.', paired: true },
]

export function normalizeTacticalObservationName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function getTacticalObservationName(event: TacticalEventSource | TacticalSelectionSource) {
  if ('reportingIdentity' in event && event.reportingIdentity?.standardIdentity?.type === 'EVENT') return event.reportingIdentity.standardIdentity.label
  if ('standardEventDefinitionAtRecording' in event && event.standardEventDefinitionAtRecording?.name) return event.standardEventDefinitionAtRecording.name
  return event.eventDefinition?.name ?? (event.eventType ? formatMatchEventType(event.eventType) : null)
}

export function getTacticalDetailOptions(name?: string | null): TacticalDetailOption[] {
  if (!name) return []
  return detailOptionsByName[name as keyof typeof detailOptionsByName] ?? []
}

export function classifyTacticalObservation(input: { name?: string | null }): Array<{ key: TacticalMetricKey; outcome: TacticalOutcome; outcomeLabel: string }> {
  const name = input.name ?? ''
  switch (name) {
    case 'Build-up from goalkeeper controlled exit': return [{ key: 'BUILD_UP_FROM_GOALKEEPER', outcome: 'success', outcomeLabel: 'Controlled exit' }]
    case 'Build-up from goalkeeper possession lost': return [{ key: 'BUILD_UP_FROM_GOALKEEPER', outcome: 'failure', outcomeLabel: 'Possession lost' }]
    case 'Build-up from goalkeeper ball out': return [{ key: 'BUILD_UP_FROM_GOALKEEPER', outcome: 'failure', outcomeLabel: 'Ball out' }]
    case 'Escape opposition press retained': return [{ key: 'ESCAPE_PRESS', outcome: 'success', outcomeLabel: 'Retained beyond press' }]
    case 'Escape opposition press unsuccessful': return [{ key: 'ESCAPE_PRESS', outcome: 'failure', outcomeLabel: 'Unsuccessful' }]
    case 'Break opposition midfield line completed': return [{ key: 'MIDFIELD_LINE_BREAKS', outcome: 'success', outcomeLabel: 'Completed' }]
    case 'Break opposition midfield line incomplete': return [{ key: 'MIDFIELD_LINE_BREAKS', outcome: 'failure', outcomeLabel: 'Incomplete' }]
    case 'Ball behind defensive line teammate receives': return [{ key: 'BALLS_BEHIND_DEFENSIVE_LINE', outcome: 'success', outcomeLabel: 'Teammate receives' }]
    case 'Ball behind defensive line opponent wins': return [{ key: 'BALLS_BEHIND_DEFENSIVE_LINE', outcome: 'failure', outcomeLabel: 'Opponent wins' }]
    case 'Ball behind defensive line offside': return [{ key: 'BALLS_BEHIND_DEFENSIVE_LINE', outcome: 'failure', outcomeLabel: 'Offside' }]
    case 'Ball behind defensive line out': return [{ key: 'BALLS_BEHIND_DEFENSIVE_LINE', outcome: 'failure', outcomeLabel: 'Out' }]
    case 'Final-third entry by pass': return [{ key: 'FINAL_THIRD_ENTRIES', outcome: 'count', outcomeLabel: 'Pass' }]
    case 'Final-third entry by carry': return [{ key: 'FINAL_THIRD_ENTRIES', outcome: 'count', outcomeLabel: 'Carry' }]
    case 'Penalty-area entry pass controlled': return [{ key: 'PENALTY_AREA_ENTRIES', outcome: 'success', outcomeLabel: 'Pass controlled' }]
    case 'Penalty-area entry pass unsuccessful': return [{ key: 'PENALTY_AREA_ENTRIES', outcome: 'failure', outcomeLabel: 'Pass unsuccessful' }]
    case 'Penalty-area entry carry controlled': return [{ key: 'PENALTY_AREA_ENTRIES', outcome: 'success', outcomeLabel: 'Carry controlled' }]
    case 'Penalty-area entry carry unsuccessful': return [{ key: 'PENALTY_AREA_ENTRIES', outcome: 'failure', outcomeLabel: 'Carry unsuccessful' }]
    case 'Penalty-area entry cross controlled': return [{ key: 'PENALTY_AREA_ENTRIES', outcome: 'success', outcomeLabel: 'Cross controlled' }]
    case 'Penalty-area entry cross unsuccessful': return [{ key: 'PENALTY_AREA_ENTRIES', outcome: 'failure', outcomeLabel: 'Cross unsuccessful' }]
    case 'Switch of play completed': return [{ key: 'SWITCHES_OF_PLAY', outcome: 'success', outcomeLabel: 'Completed' }]
    case 'Switch of play incomplete': return [{ key: 'SWITCHES_OF_PLAY', outcome: 'failure', outcomeLabel: 'Incomplete' }]
    case 'Cutback reaches teammate': return [{ key: 'CUTBACKS', outcome: 'success', outcomeLabel: 'Reaches teammate' }]
    case 'Cutback intercepted': return [{ key: 'CUTBACKS', outcome: 'failure', outcomeLabel: 'Intercepted' }]
    case 'Cutback out': return [{ key: 'CUTBACKS', outcome: 'failure', outcomeLabel: 'Out' }]
    case 'Press triggered regain': return [{ key: 'PRESS_TRIGGERED', outcome: 'success', outcomeLabel: 'Regain' }]
    case 'Press triggered force long ball': return [{ key: 'PRESS_TRIGGERED', outcome: 'count', outcomeLabel: 'Forced long ball' }]
    case 'Press triggered force backwards': return [{ key: 'PRESS_TRIGGERED', outcome: 'count', outcomeLabel: 'Forced backwards' }]
    case 'Press triggered opponent escapes': return [{ key: 'PRESS_TRIGGERED', outcome: 'failure', outcomeLabel: 'Opponent escapes' }]
    case 'Counter-press regain': return [{ key: 'COUNTER_PRESS_REGAINS', outcome: 'count', outcomeLabel: 'Recovered within 5 seconds' }]
    case 'Attack following regain box entry': return [{ key: 'ATTACKS_FOLLOWING_REGAIN', outcome: 'success', outcomeLabel: 'Box entry' }]
    case 'Attack following regain shot': return [{ key: 'ATTACKS_FOLLOWING_REGAIN', outcome: 'success', outcomeLabel: 'Shot' }]
    case 'Attack following regain goal': return [{ key: 'ATTACKS_FOLLOWING_REGAIN', outcome: 'success', outcomeLabel: 'Goal' }]
    case 'Attack following regain possession lost': return [{ key: 'ATTACKS_FOLLOWING_REGAIN', outcome: 'failure', outcomeLabel: 'Possession lost' }]
    case 'Opposition attack following our loss stopped': return [{ key: 'OPPOSITION_ATTACKS_FOLLOWING_OUR_LOSS', outcome: 'success', outcomeLabel: 'Stopped' }]
    case 'Opposition attack following our loss delayed': return [{ key: 'OPPOSITION_ATTACKS_FOLLOWING_OUR_LOSS', outcome: 'count', outcomeLabel: 'Delayed' }]
    case 'Opposition attack following our loss box entry conceded': return [{ key: 'OPPOSITION_ATTACKS_FOLLOWING_OUR_LOSS', outcome: 'failure', outcomeLabel: 'Box entry conceded' }]
    case 'Opposition attack following our loss shot conceded': return [{ key: 'OPPOSITION_ATTACKS_FOLLOWING_OUR_LOSS', outcome: 'failure', outcomeLabel: 'Shot conceded' }]
    case 'Second ball won': return [{ key: 'SECOND_BALLS', outcome: 'success', outcomeLabel: 'Won' }]
    case 'Second ball lost': return [{ key: 'SECOND_BALLS', outcome: 'failure', outcomeLabel: 'Lost' }]
    case 'Opposition central penetration prevented': return [{ key: 'OPPOSITION_CENTRAL_PENETRATION', outcome: 'success', outcomeLabel: 'Prevented' }]
    case 'Opposition central penetration completed': return [{ key: 'OPPOSITION_CENTRAL_PENETRATION', outcome: 'failure', outcomeLabel: 'Completed' }]
    case 'Attacking corner routine': return [{ key: 'ATTACKING_SET_PIECES', outcome: 'count', outcomeLabel: 'Corner routine' }]
    case 'Attacking free-kick routine': return [{ key: 'ATTACKING_SET_PIECES', outcome: 'count', outcomeLabel: 'Free-kick routine' }]
    case 'Attacking set-piece first contact won': return [{ key: 'ATTACKING_SET_PIECES', outcome: 'success', outcomeLabel: 'First contact won' }]
    case 'Attacking set-piece first contact lost': return [{ key: 'ATTACKING_SET_PIECES', outcome: 'failure', outcomeLabel: 'First contact lost' }]
    case 'Attacking set-piece shot': return [{ key: 'ATTACKING_SET_PIECES', outcome: 'success', outcomeLabel: 'Shot' }]
    case 'Defending corner or free kick first contact won': return [{ key: 'DEFENDING_SET_PIECES', outcome: 'success', outcomeLabel: 'First contact won' }]
    case 'Defending corner or free kick first contact lost': return [{ key: 'DEFENDING_SET_PIECES', outcome: 'failure', outcomeLabel: 'First contact lost' }]
    case 'Defending set-piece second ball won': return [{ key: 'DEFENDING_SET_PIECES', outcome: 'success', outcomeLabel: 'Second ball won' }]
    case 'Defending set-piece second ball lost': return [{ key: 'DEFENDING_SET_PIECES', outcome: 'failure', outcomeLabel: 'Second ball lost' }]
    case 'Defending set-piece shot conceded': return [{ key: 'DEFENDING_SET_PIECES', outcome: 'failure', outcomeLabel: 'Shot conceded' }]
    case 'Our throw-in possession retained': return [{ key: 'THROW_INS', outcome: 'success', outcomeLabel: 'Possession retained' }]
    case 'Our throw-in possession lost': return [{ key: 'THROW_INS', outcome: 'failure', outcomeLabel: 'Possession lost' }]
    default: return []
  }
}

export function buildTacticalObservationReport({ events, selections, side = 'ALL' }: { events: TacticalEventSource[]; selections: TacticalSelectionSource[]; side?: TacticalObservationSide | 'ALL' }): TacticalObservationReport {
  const selectedOutcomes = new Map<TacticalMetricKey, Set<TacticalOutcome>>()
  const totals = new Map<TacticalMetricKey, TacticalMetricTotalRow>()
  const filteredEvents = side === 'ALL' ? events : events.filter((event) => (event.teamSide ?? 'OUR_TEAM') === side)

  for (const selection of selections) {
    for (const item of classifyTacticalObservation({ name: getTacticalObservationName(selection) })) {
      const outcomes = selectedOutcomes.get(item.key) ?? new Set<TacticalOutcome>()
      outcomes.add(item.outcome)
      selectedOutcomes.set(item.key, outcomes)
    }
  }

  for (const event of filteredEvents) {
    const name = getTacticalObservationName(event)
    for (const item of classifyTacticalObservation({ name })) {
      const row = totals.get(item.key) ?? { successes: 0, failures: 0, count: 0, ourTeam: 0, opposition: 0, outcomes: new Map<string, number>(), details: new Map<string, number>() }
      if (item.outcome === 'success') row.successes += 1
      else if (item.outcome === 'failure') row.failures += 1
      else row.count += 1
      if (event.teamSide === 'OPPOSITION') row.opposition += 1
      else row.ourTeam += 1
      row.outcomes.set(item.outcomeLabel, (row.outcomes.get(item.outcomeLabel) ?? 0) + 1)
      const detailLabel = getDetailLabel(name, event.detailCode)
      if (detailLabel) row.details.set(detailLabel, (row.details.get(detailLabel) ?? 0) + 1)
      totals.set(item.key, row)
    }
  }

  const causalMeasures = buildCausalMeasures(filteredEvents)
  return {
    metrics: tacticalMetricDefinitions.map((definition) => buildMetricCount(definition, totals.get(definition.key), selectedOutcomes.get(definition.key))),
    causalMeasures,
    unavailableMeasures: getUnavailableMeasures(causalMeasures),
  }
}

function buildMetricCount(definition: TacticalMetricDefinition, row: TacticalMetricTotalRow | undefined, selectedOutcomes: Set<TacticalOutcome> | undefined): TacticalMetricCount {
  const successes = row?.successes ?? 0
  const failures = row?.failures ?? 0
  const count = row?.count ?? 0
  const total = successes + failures + count
  const successTracked = Boolean(selectedOutcomes?.has('success'))
  const failureTracked = Boolean(selectedOutcomes?.has('failure'))
  const tracked = Boolean(selectedOutcomes && selectedOutcomes.size > 0)
  const attempts = definition.paired && successTracked && failureTracked ? successes + failures : definition.paired ? null : total
  return {
    key: definition.key,
    label: definition.label,
    question: definition.question,
    attempts,
    successes: definition.paired ? successes : null,
    failures: definition.paired ? failures : null,
    total,
    successRate: definition.paired && attempts && attempts > 0 ? successes / attempts : null,
    tracked,
    coverageLabel: getCoverageLabel({ tracked, total, paired: definition.paired, successTracked, failureTracked }),
    ourTeamTotal: row?.ourTeam ?? 0,
    oppositionTotal: row?.opposition ?? 0,
    outcomeBreakdown: sortBreakdown(row?.outcomes),
    detailBreakdown: sortBreakdown(row?.details),
  }
}

function getCoverageLabel(input: { tracked: boolean; total: number; paired: boolean; successTracked: boolean; failureTracked: boolean }) {
  if (!input.tracked) return 'Not tracked in setup'
  if (input.total === 0) return 'Tracked, zero recorded'
  if (input.paired && (!input.successTracked || !input.failureTracked)) return 'Count only; attempts and success percentage unavailable'
  return 'Tracked observations recorded'
}

function sortBreakdown(values?: Map<string, number>) {
  return Array.from(values?.entries() ?? [])
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label))
}

function getDetailLabel(name: string | null, detailCode?: string | null) {
  if (!name || !detailCode) return null
  return getTacticalDetailOptions(name).find((option) => option.code === detailCode)?.label ?? detailCode
}

function buildCausalMeasures(events: TacticalEventSource[]): TacticalCausalMeasure[] {
  const rules = [
    { key: 'REGAINS_TO_SHOTS', label: 'Regains producing a shot / tracked regains', sequenceType: 'ATTACK_AFTER_REGAIN', startNames: ['Ball recovery', 'Press triggered regain', 'Counter-press regain'], outcomeNames: ['Attack following regain shot', 'Attack following regain goal'], maxSeconds: 15, sideRule: 'SAME_SIDE' as const },
    { key: 'FINAL_THIRD_TO_BOX_OR_SHOT', label: 'Final-third entries followed by box entry or shot / tracked entries', sequenceType: 'FINAL_THIRD_ATTACK', startNames: ['Final-third entry by pass', 'Final-third entry by carry'], outcomeNames: ['Penalty-area entry pass controlled', 'Penalty-area entry carry controlled', 'Penalty-area entry cross controlled', 'Attack following regain shot', 'Attack following regain goal'], maxSeconds: 20, sideRule: 'SAME_SIDE' as const },
    { key: 'LOSSES_TO_OPPOSITION_SHOTS', label: 'Losses followed by an opposition shot / tracked losses', sequenceType: 'OPPOSITION_ATTACK_AFTER_OUR_LOSS', startNames: ['Build-up from goalkeeper possession lost', 'Escape opposition press unsuccessful', 'Attack following regain possession lost', 'Our throw-in possession lost'], outcomeNames: ['Opposition attack following our loss shot conceded'], maxSeconds: 15, sideRule: 'OUR_LOSS_OPPOSITION_OUTCOME' as const },
    { key: 'CORNERS_TO_SHOTS', label: 'Corners producing a shot / tracked corners', sequenceType: 'ATTACKING_SET_PIECE', startNames: ['Attacking corner routine'], outcomeNames: ['Attacking set-piece shot'], maxSeconds: 15, sideRule: 'SAME_SIDE' as const },
  ]

  return rules.flatMap((rule) => {
    const counts = countCausalStarts(events, rule)
    const denominator = counts.denominator
    const numerator = counts.numerator
    if (denominator === 0) return []
    return [{ key: rule.key, label: rule.label, numerator, denominator, rate: numerator / denominator, coverageLabel: 'Valid linked sequences recorded' }]
  })
}

function countCausalStarts(events: TacticalEventSource[], rule: { sequenceType: string; startNames: string[]; outcomeNames: string[]; maxSeconds: number; sideRule: 'SAME_SIDE' | 'OUR_LOSS_OPPOSITION_OUTCOME' }) {
  const eventsBySequenceId = new Map<string, TacticalEventSource[]>()
  for (const event of events) {
    if (!event.tacticalSequenceId || !event.tacticalSequence) continue
    const sequenceEvents = eventsBySequenceId.get(event.tacticalSequenceId) ?? []
    sequenceEvents.push(event)
    eventsBySequenceId.set(event.tacticalSequenceId, sequenceEvents)
  }

  let denominator = 0
  let numerator = 0
  for (const sequenceEvents of eventsBySequenceId.values()) {
    const sequence = sequenceEvents[0]?.tacticalSequence
    if (!sequence || sequence.sequenceType !== rule.sequenceType) continue
    const startEvents = sequenceEvents.filter((event) => rule.startNames.includes(getTacticalObservationName(event) ?? '') && isEligibleCausalStart(event, sequence, rule))
    const outcomeEvents = sequenceEvents.filter((event) => rule.outcomeNames.includes(getTacticalObservationName(event) ?? ''))

    for (const startEvent of startEvents) {
      denominator += 1
      if (outcomeEvents.some((outcomeEvent) => isValidSequencePair(startEvent, outcomeEvent, sequence, rule))) numerator += 1
    }
  }

  return { numerator, denominator }
}

function isEligibleCausalStart(startEvent: TacticalEventSource, sequence: TacticalSequenceSource, rule: { sideRule: 'SAME_SIDE' | 'OUR_LOSS_OPPOSITION_OUTCOME' }) {
  if (sequence.matchDayId && startEvent.matchDayId && sequence.matchDayId !== startEvent.matchDayId) return false
  if (!eventFitsSequenceWindow(startEvent, sequence)) return false

  const startSide = startEvent.teamSide ?? 'OUR_TEAM'
  if (rule.sideRule === 'SAME_SIDE') return (sequence.teamSide ?? startSide) === startSide
  return startSide === 'OUR_TEAM' && (sequence.teamSide ?? 'OPPOSITION') === 'OPPOSITION'
}

function isValidSequencePair(startEvent: TacticalEventSource, outcomeEvent: TacticalEventSource, sequence: TacticalSequenceSource, rule: { maxSeconds: number; sideRule: 'SAME_SIDE' | 'OUR_LOSS_OPPOSITION_OUTCOME' }) {
  if (startEvent.matchDayId && outcomeEvent.matchDayId && startEvent.matchDayId !== outcomeEvent.matchDayId) return false
  if (sequence.matchDayId && startEvent.matchDayId && sequence.matchDayId !== startEvent.matchDayId) return false
  if (sequence.matchDayId && outcomeEvent.matchDayId && sequence.matchDayId !== outcomeEvent.matchDayId) return false
  if (!isOrderedWithinWindow(startEvent, outcomeEvent, rule.maxSeconds)) return false
  if (!eventFitsSequenceWindow(startEvent, sequence) || !eventFitsSequenceWindow(outcomeEvent, sequence)) return false

  const startSide = startEvent.teamSide ?? 'OUR_TEAM'
  const outcomeSide = outcomeEvent.teamSide ?? 'OUR_TEAM'
  if (rule.sideRule === 'SAME_SIDE') return startSide === outcomeSide && (sequence.teamSide ?? startSide) === startSide
  return startSide === 'OUR_TEAM' && outcomeSide === 'OPPOSITION' && (sequence.teamSide ?? 'OPPOSITION') === 'OPPOSITION'
}

function isOrderedWithinWindow(startEvent: TacticalEventSource, outcomeEvent: TacticalEventSource, maxSeconds: number) {
  if (typeof startEvent.matchSecond !== 'number' || typeof outcomeEvent.matchSecond !== 'number') return false
  if (startEvent.half && outcomeEvent.half && startEvent.half !== outcomeEvent.half) return false
  const elapsed = outcomeEvent.matchSecond - startEvent.matchSecond
  return elapsed >= 0 && elapsed <= maxSeconds
}

function eventFitsSequenceWindow(event: TacticalEventSource, sequence: TacticalSequenceSource) {
  if (typeof event.matchSecond !== 'number') return false
  if (event.half && event.half !== sequence.startHalf) return false
  const endMatchSecond = sequence.endMatchSecond ?? sequence.startMatchSecond + (sequence.timeWindowSeconds ?? 0)
  const lowerBound = sequence.startMatchSecond
  const upperBound = Math.max(lowerBound, endMatchSecond)
  return event.matchSecond >= lowerBound && event.matchSecond <= upperBound
}

function getUnavailableMeasures(causalMeasures: TacticalCausalMeasure[]): TacticalUnavailableMeasure[] {
  const availableKeys = new Set(causalMeasures.map((measure) => measure.key))
  const definitions = [
    { key: 'REGAINS_TO_SHOTS', label: 'Regains producing a shot / tracked regains', reason: 'Unavailable until regain and shot events are explicitly linked in an ATTACK_AFTER_REGAIN sequence within 15 seconds.' },
    { key: 'FINAL_THIRD_TO_BOX_OR_SHOT', label: 'Final-third entries followed by box entry or shot / tracked entries', reason: 'Unavailable until entry and outcome events are explicitly linked in a FINAL_THIRD_ATTACK sequence within 20 seconds.' },
    { key: 'LOSSES_TO_OPPOSITION_SHOTS', label: 'Losses followed by an opposition shot / tracked losses', reason: 'Unavailable until our loss and opposition-shot events are explicitly linked in an OPPOSITION_ATTACK_AFTER_OUR_LOSS sequence within 15 seconds.' },
    { key: 'CORNERS_TO_SHOTS', label: 'Corners producing a shot / tracked corners', reason: 'Unavailable until corner routine and shot events are explicitly linked in an ATTACKING_SET_PIECE sequence within 15 seconds.' },
  ]
  return definitions.filter((definition) => !availableKeys.has(definition.key)).map(({ label, reason }) => ({ label, reason }))
}

export function resolveTacticalPresetEventIds(events: Array<{ id: string; label: string }>, presetKey: string, maxSelections = Infinity): TacticalPresetResolution {
  const preset = tacticalPresets.find((candidate) => candidate.key === presetKey)
  if (!preset) return { ok: false, reason: 'That tactical preset is not recognised.' }

  const duplicatePresetNames = preset.eventNames.filter((name, index) => preset.eventNames.indexOf(name) !== index)
  if (duplicatePresetNames.length > 0) return { ok: false, reason: `That tactical preset contains duplicate events: ${Array.from(new Set(duplicatePresetNames)).join(', ')}.` }
  if (preset.eventNames.length > maxSelections) return { ok: false, reason: `That tactical preset contains ${preset.eventNames.length} events, above the ${maxSelections} event recommended limit.` }

  const eventsByName = new Map<string, string>()
  const duplicateSelectableNames = new Set<string>()
  for (const event of events) {
    if (eventsByName.has(event.label)) duplicateSelectableNames.add(event.label)
    eventsByName.set(event.label, event.id)
  }

  const duplicatedNamesInPreset = preset.eventNames.filter((name) => duplicateSelectableNames.has(name))
  if (duplicatedNamesInPreset.length > 0) return { ok: false, reason: `That tactical preset cannot be applied because multiple selectable definitions share: ${duplicatedNamesInPreset.join(', ')}.` }

  const missingNames = preset.eventNames.filter((name) => !eventsByName.has(name))
  if (missingNames.length > 0) return { ok: false, reason: `That tactical preset is unavailable because these definitions are missing: ${missingNames.join(', ')}.` }

  const eventIds = preset.eventNames.map((name) => eventsByName.get(name)!)
  if (eventIds.length === 0) return { ok: false, reason: 'That tactical preset is not available in this event library yet.' }
  return { ok: true, eventIds }
}

export function getTacticalPresetEventIds(events: Array<{ id: string; label: string }>, presetKey: string) {
  const result = resolveTacticalPresetEventIds(events, presetKey)
  return result.ok ? result.eventIds : []
}

export { detailOptionsByName }
