import { formatMatchEventType } from '@/lib/matchEventTaxonomy'
import type { ObservationReportingIdentity } from '@/lib/observationReporting'

export type FootballMetricKey =
  | 'INTERCEPTIONS'
  | 'BALL_RECOVERIES'
  | 'CLEARANCES'
  | 'HEADED_CLEARANCES'
  | 'SHOT_BLOCKS'
  | 'PASSES'
  | 'FORWARD_PASSES'
  | 'FINAL_THIRD_PASSES'
  | 'LONG_PASSES'
  | 'PENALTY_AREA_PASSES'
  | 'KEY_PASSES'
  | 'ASSISTS'
  | 'CHANCES_CREATED'
  | 'THROUGH_BALLS'
  | 'CROSSES'
  | 'DRIBBLES'
  | 'SHOTS'
  | 'SHOTS_ON_TARGET'
  | 'GOALS'
  | 'TACKLES'
  | 'GROUND_DUELS'
  | 'AERIAL_DUELS'
  | 'FOULS_COMMITTED'
  | 'FOULS_WON'
  | 'GOALKEEPER_SAVES'
  | 'GOALKEEPER_HIGH_CLAIMS'
  | 'GOALKEEPER_PUNCHES'
  | 'GOALKEEPER_SWEEPER_CLEARANCES'

type Outcome = 'attempt' | 'success' | 'failure' | 'count'

export type FootballMetricDefinition = {
  key: FootballMetricKey
  label: string
  shortLabel: string
  guidance: string
  successLabel?: string
  failureLabel?: string
}

export type FootballMetricEventSource = {
  id: string
  playerId?: string | null
  eventType?: string | null
  eventDefinitionId?: string | null
  eventDefinition?: { name?: string | null } | null
  standardEventDefinitionAtRecording?: { name?: string | null } | null
  reportingIdentity?: ObservationReportingIdentity
}

export type FootballMetricSelectionSource = {
  eventType?: string | null
  eventDefinitionId?: string | null
  eventDefinition?: { name?: string | null } | null
}

export type FootballMetricCount = {
  key: FootballMetricKey
  label: string
  attempts: number | null
  successes: number | null
  failures: number | null
  total: number
  successRate: number | null
  tracked: boolean
  successOutcomeTracked: boolean
  failureOutcomeTracked: boolean
  coverageLabel: string
}

export type FootballPlayerMetricRow = {
  playerId: string
  playerName: string
  minutesPlayed: number | null
  metrics: FootballMetricCount[]
  per90: Partial<Record<FootballMetricKey, number | null>>
}

export type FootballLeaderboard = {
  key: FootballMetricKey
  label: string
  rows: Array<{ playerId: string; playerName: string; value: number; per90: number | null }>
  coverageLabel: string
}

export type FootballMetricReport = {
  metrics: FootballMetricCount[]
  playerRows: FootballPlayerMetricRow[]
  leaderboards: FootballLeaderboard[]
}

const canonicalNameBySlug = {
  'interception': 'Interception',
  'ball-recovery': 'Ball recovery',
  'clearance': 'Clearance',
  'headed-clearance': 'Headed clearance',
  'shot-block': 'Shot block',
  'pass-complete': 'Pass complete',
  'pass-completed': 'Pass complete',
  'pass-incomplete': 'Pass incomplete',
  'forward-pass-completed': 'Forward pass completed',
  'forward-pass-incomplete': 'Forward pass incomplete',
  'pass-into-final-third-completed': 'Pass into final third completed',
  'pass-into-final-third-incomplete': 'Pass into final third incomplete',
  'long-pass-completed': 'Long pass completed',
  'long-pass-incomplete': 'Long pass incomplete',
  'pass-into-penalty-area-completed': 'Pass into penalty area completed',
  'pass-into-penalty-area-incomplete': 'Pass into penalty area incomplete',
  'key-pass': 'Key pass',
  'assist': 'Assist',
  'through-ball': 'Through ball',
  'cross-completed': 'Cross completed',
  'cross-incomplete': 'Cross incomplete',
  'dribble-successful': 'Dribble successful',
  'dribble-unsuccessful': 'Dribble unsuccessful',
  'shot': 'Shot',
  'shot-on-target': 'Shot on target',
  'shot-off-target': 'Shot off target',
  'goal': 'Goal',
  'tackle-won': 'Tackle won',
  'tackle-lost': 'Tackle lost',
  'ground-duel-won': 'Ground duel won',
  'ground-duel-lost': 'Ground duel lost',
  'aerial-duel-won': 'Aerial duel won',
  'aerial-duel-lost': 'Aerial duel lost',
  'foul-committed': 'Foul committed',
  'foul-won': 'Foul won',
  'goalkeeper-save': 'Goalkeeper save',
  'goalkeeper-high-claim': 'Goalkeeper high claim',
  'goalkeeper-punch': 'Goalkeeper punch',
  'goalkeeper-sweeper-clearance': 'Goalkeeper sweeper clearance',
} satisfies Record<string, string>

export const footballMetricDefinitions: FootballMetricDefinition[] = [
  { key: 'INTERCEPTIONS', label: 'Interceptions', shortLabel: 'Interceptions', guidance: 'Anticipating an opponent pass and moving into its path.' },
  { key: 'BALL_RECOVERIES', label: 'Ball recoveries', shortLabel: 'Recoveries', guidance: 'Establishing controlled possession after a turnover.' },
  { key: 'CLEARANCES', label: 'Clearances', shortLabel: 'Clearances', guidance: 'Defensive action to move the ball away from danger without a clear teammate target.' },
  { key: 'HEADED_CLEARANCES', label: 'Headed clearances', shortLabel: 'Headed clearances', guidance: 'A clearance made with the head.' },
  { key: 'SHOT_BLOCKS', label: 'Shot blocks', shortLabel: 'Shot blocks', guidance: 'Defender blocks an opponent shot that would otherwise continue towards goal.' },
  { key: 'PASSES', label: 'Passes', shortLabel: 'Passes', guidance: 'Attempted delivery to a teammate. Crosses, keeper throws and throw-ins are treated separately.', successLabel: 'Completed', failureLabel: 'Incomplete' },
  { key: 'FORWARD_PASSES', label: 'Forward passes', shortLabel: 'Forward passes', guidance: 'A pass whose intended destination is meaningfully closer to the opponent goal than its start point.', successLabel: 'Completed', failureLabel: 'Incomplete' },
  { key: 'FINAL_THIRD_PASSES', label: 'Passes into final third', shortLabel: 'Final-third passes', guidance: 'A pass starting outside the attacking third and entering it. It is not automatically classed as a forward pass.', successLabel: 'Completed', failureLabel: 'Incomplete' },
  { key: 'LONG_PASSES', label: 'Long passes', shortLabel: 'Long passes', guidance: 'A deliberate longer pass to a teammate or target space.', successLabel: 'Completed', failureLabel: 'Incomplete' },
  { key: 'PENALTY_AREA_PASSES', label: 'Passes into penalty area', shortLabel: 'Penalty-area passes', guidance: 'A pass whose intended destination enters the opponent penalty area.', successLabel: 'Completed', failureLabel: 'Incomplete' },
  { key: 'KEY_PASSES', label: 'Key passes', shortLabel: 'Key passes', guidance: 'Final pass to a teammate who then shoots but does not score.' },
  { key: 'ASSISTS', label: 'Assists', shortLabel: 'Assists', guidance: 'Final teammate action leading directly to a goal.' },
  { key: 'CHANCES_CREATED', label: 'Chances created', shortLabel: 'Chances created', guidance: 'Derived as key passes plus assists.' },
  { key: 'THROUGH_BALLS', label: 'Through balls', shortLabel: 'Through balls', guidance: 'Pass splitting the defensive line for a teammate to run onto.' },
  { key: 'CROSSES', label: 'Crosses', shortLabel: 'Crosses', guidance: 'Wide delivery targeting teammate(s) in a central goal-scoring area.', successLabel: 'Completed', failureLabel: 'Incomplete' },
  { key: 'DRIBBLES', label: 'Dribbles', shortLabel: 'Dribbles', guidance: 'Attempt to beat an opponent while in possession.', successLabel: 'Successful', failureLabel: 'Unsuccessful' },
  { key: 'SHOTS', label: 'Shots', shortLabel: 'Shots', guidance: 'Deliberate attempt to score. Shot blocks are treated as defensive actions unless attacker shot outcome is recorded.' },
  { key: 'SHOTS_ON_TARGET', label: 'Shots on target', shortLabel: 'Shots on target', guidance: 'Shot that tests the goalkeeper or would enter the goal without defensive intervention.' },
  { key: 'GOALS', label: 'Goals', shortLabel: 'Goals', guidance: 'Goal scored by the player/team.' },
  { key: 'TACKLES', label: 'Tackles', shortLabel: 'Tackles', guidance: 'Legal ground challenge taking the ball from an opponent in controlled possession.', successLabel: 'Won', failureLabel: 'Lost' },
  { key: 'GROUND_DUELS', label: 'Ground duels', shortLabel: 'Ground duels', guidance: 'Ground contest between opposing players.', successLabel: 'Won', failureLabel: 'Lost' },
  { key: 'AERIAL_DUELS', label: 'Aerial duels', shortLabel: 'Aerial duels', guidance: 'Aerial contest between opposing players.', successLabel: 'Won', failureLabel: 'Lost' },
  { key: 'FOULS_COMMITTED', label: 'Fouls committed', shortLabel: 'Fouls committed', guidance: 'Foul penalised against the player/team.' },
  { key: 'FOULS_WON', label: 'Fouls won', shortLabel: 'Fouls won', guidance: 'Free kick or penalty won by being fouled.' },
  { key: 'GOALKEEPER_SAVES', label: 'Goalkeeper saves', shortLabel: 'Saves', guidance: 'Goalkeeper prevents an intentional attempt from entering the goal.' },
  { key: 'GOALKEEPER_HIGH_CLAIMS', label: 'Goalkeeper high claims', shortLabel: 'High claims', guidance: 'Goalkeeper catches a high ball played into the penalty area.' },
  { key: 'GOALKEEPER_PUNCHES', label: 'Goalkeeper punches', shortLabel: 'Punches', guidance: 'Goalkeeper punches a high ball clear rather than claiming it.' },
  { key: 'GOALKEEPER_SWEEPER_CLEARANCES', label: 'Goalkeeper sweeper clearances', shortLabel: 'Sweeper clearances', guidance: 'Goalkeeper reads danger and rushes out to clear or claim outside normal goalkeeping position.' },
]

const definitionByKey = new Map(footballMetricDefinitions.map((definition) => [definition.key, definition]))
const pairedMetricKeys = new Set<FootballMetricKey>(['PASSES', 'FORWARD_PASSES', 'FINAL_THIRD_PASSES', 'LONG_PASSES', 'PENALTY_AREA_PASSES', 'CROSSES', 'DRIBBLES', 'TACKLES', 'GROUND_DUELS', 'AERIAL_DUELS'])
const leaderboardKeys: FootballMetricKey[] = ['INTERCEPTIONS', 'FORWARD_PASSES', 'FINAL_THIRD_PASSES', 'TACKLES']

export const ambiguousHistoricalObservationNames = ['Forward pass', 'Cross', 'Possession gained', '1v1 success', '1v1 unsuccessful']

export function normalizeFootballObservationName(value: string) {
  return value.toLowerCase().replace(/1\s*v\s*1/g, '1v1').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function classifyFootballObservation(input: { name?: string | null; eventType?: string | null }): Array<{ key: FootballMetricKey; outcome: Outcome }> {
  const rawName = input.name ?? (input.eventType ? formatMatchEventType(input.eventType) : null)
  if (!rawName) return []
  const name = canonicalNameBySlug[normalizeFootballObservationName(rawName) as keyof typeof canonicalNameBySlug] ?? rawName
  switch (name) {
    case 'Interception': return [{ key: 'INTERCEPTIONS', outcome: 'count' }]
    case 'Ball recovery': return [{ key: 'BALL_RECOVERIES', outcome: 'count' }]
    case 'Clearance': return [{ key: 'CLEARANCES', outcome: 'count' }]
    case 'Headed clearance': return [{ key: 'CLEARANCES', outcome: 'count' }, { key: 'HEADED_CLEARANCES', outcome: 'count' }]
    case 'Shot block':
    case 'Shot blocked': return [{ key: 'SHOT_BLOCKS', outcome: 'count' }]
    case 'Pass complete': return [{ key: 'PASSES', outcome: 'success' }]
    case 'Pass incomplete': return [{ key: 'PASSES', outcome: 'failure' }]
    case 'Forward pass completed': return [{ key: 'PASSES', outcome: 'success' }, { key: 'FORWARD_PASSES', outcome: 'success' }]
    case 'Forward pass incomplete': return [{ key: 'PASSES', outcome: 'failure' }, { key: 'FORWARD_PASSES', outcome: 'failure' }]
    case 'Pass into final third completed': return [{ key: 'PASSES', outcome: 'success' }, { key: 'FINAL_THIRD_PASSES', outcome: 'success' }]
    case 'Pass into final third incomplete': return [{ key: 'PASSES', outcome: 'failure' }, { key: 'FINAL_THIRD_PASSES', outcome: 'failure' }]
    case 'Long pass completed': return [{ key: 'PASSES', outcome: 'success' }, { key: 'LONG_PASSES', outcome: 'success' }]
    case 'Long pass incomplete': return [{ key: 'PASSES', outcome: 'failure' }, { key: 'LONG_PASSES', outcome: 'failure' }]
    case 'Pass into penalty area completed': return [{ key: 'PASSES', outcome: 'success' }, { key: 'PENALTY_AREA_PASSES', outcome: 'success' }]
    case 'Pass into penalty area incomplete': return [{ key: 'PASSES', outcome: 'failure' }, { key: 'PENALTY_AREA_PASSES', outcome: 'failure' }]
    case 'Key pass': return [{ key: 'KEY_PASSES', outcome: 'count' }, { key: 'CHANCES_CREATED', outcome: 'count' }, { key: 'PASSES', outcome: 'success' }]
    case 'Assist': return [{ key: 'ASSISTS', outcome: 'count' }, { key: 'CHANCES_CREATED', outcome: 'count' }, { key: 'PASSES', outcome: 'success' }]
    case 'Through ball': return [{ key: 'THROUGH_BALLS', outcome: 'count' }, { key: 'PASSES', outcome: 'success' }]
    case 'Cross completed': return [{ key: 'CROSSES', outcome: 'success' }]
    case 'Cross incomplete': return [{ key: 'CROSSES', outcome: 'failure' }]
    case 'Dribble successful': return [{ key: 'DRIBBLES', outcome: 'success' }]
    case 'Dribble unsuccessful': return [{ key: 'DRIBBLES', outcome: 'failure' }]
    case 'Shot': return [{ key: 'SHOTS', outcome: 'count' }]
    case 'Shot on target': return [{ key: 'SHOTS', outcome: 'count' }, { key: 'SHOTS_ON_TARGET', outcome: 'count' }]
    case 'Shot off target': return [{ key: 'SHOTS', outcome: 'count' }]
    case 'Goal': return [{ key: 'SHOTS', outcome: 'count' }, { key: 'SHOTS_ON_TARGET', outcome: 'count' }, { key: 'GOALS', outcome: 'count' }]
    case 'Tackle won': return [{ key: 'TACKLES', outcome: 'success' }, { key: 'GROUND_DUELS', outcome: 'success' }]
    case 'Tackle lost': return [{ key: 'TACKLES', outcome: 'failure' }, { key: 'GROUND_DUELS', outcome: 'failure' }]
    case 'Ground duel won': return [{ key: 'GROUND_DUELS', outcome: 'success' }]
    case 'Ground duel lost': return [{ key: 'GROUND_DUELS', outcome: 'failure' }]
    case 'Aerial duel won': return [{ key: 'AERIAL_DUELS', outcome: 'success' }]
    case 'Aerial duel lost': return [{ key: 'AERIAL_DUELS', outcome: 'failure' }]
    case 'Foul committed': return [{ key: 'FOULS_COMMITTED', outcome: 'count' }]
    case 'Foul won': return [{ key: 'FOULS_WON', outcome: 'count' }]
    case 'Goalkeeper save': return [{ key: 'GOALKEEPER_SAVES', outcome: 'count' }]
    case 'Goalkeeper high claim': return [{ key: 'GOALKEEPER_HIGH_CLAIMS', outcome: 'count' }]
    case 'Goalkeeper punch': return [{ key: 'GOALKEEPER_PUNCHES', outcome: 'count' }]
    case 'Goalkeeper sweeper clearance': return [{ key: 'GOALKEEPER_SWEEPER_CLEARANCES', outcome: 'count' }]
    default: return []
  }
}

export function getFootballObservationName(event: FootballMetricEventSource | FootballMetricSelectionSource) {
  if ('reportingIdentity' in event && event.reportingIdentity?.standardIdentity?.type === 'EVENT') return event.reportingIdentity.standardIdentity.label
  if ('standardEventDefinitionAtRecording' in event && event.standardEventDefinitionAtRecording?.name) return event.standardEventDefinitionAtRecording.name
  return event.eventDefinition?.name ?? (event.eventType ? formatMatchEventType(event.eventType) : null)
}

export function buildFootballMetricReport({
  events,
  selections,
  players,
}: {
  events: FootballMetricEventSource[]
  selections: FootballMetricSelectionSource[]
  players: Array<{ playerId: string; playerName: string; minutesPlayed?: number | null }>
}): FootballMetricReport {
  const selectedOutcomes = new Map<FootballMetricKey, Set<Outcome>>()
  const metricTotals = new Map<FootballMetricKey, { successes: number; failures: number; count: number }>()
  const playerMetricTotals = new Map<string, Map<FootballMetricKey, { successes: number; failures: number; count: number }>>()

  for (const selection of selections) {
    for (const item of classifyFootballObservation({ name: getFootballObservationName(selection), eventType: selection.eventType })) {
      const outcomes = selectedOutcomes.get(item.key) ?? new Set<Outcome>()
      outcomes.add(item.outcome)
      selectedOutcomes.set(item.key, outcomes)
    }
  }

  for (const event of events) {
    for (const item of classifyFootballObservation({ name: getFootballObservationName(event), eventType: event.eventType })) {
      addMetricCount(metricTotals, item.key, item.outcome)
      if (event.playerId) addMetricCount(playerMetricTotals.get(event.playerId) ?? setPlayerMap(playerMetricTotals, event.playerId), item.key, item.outcome)
    }
  }

  const metrics = footballMetricDefinitions.map((definition) => buildMetricCount(definition.key, metricTotals.get(definition.key), selectedOutcomes.get(definition.key)))
  const playerRows = players.map((player) => {
    const playerMetrics = footballMetricDefinitions.map((definition) => buildMetricCount(definition.key, playerMetricTotals.get(player.playerId)?.get(definition.key), selectedOutcomes.get(definition.key)))
    return {
      playerId: player.playerId,
      playerName: player.playerName,
      minutesPlayed: player.minutesPlayed ?? null,
      metrics: playerMetrics,
      per90: Object.fromEntries(playerMetrics.map((metric) => [metric.key, player.minutesPlayed && player.minutesPlayed > 0 ? metric.total * 90 / player.minutesPlayed : null])),
    }
  })
  const leaderboards = leaderboardKeys.map((key) => {
    const definition = definitionByKey.get(key)!
    return {
      key,
      label: definition.label,
      coverageLabel: metrics.find((metric) => metric.key === key)?.coverageLabel ?? 'Not tracked',
      rows: playerRows
        .map((player) => {
          const value = player.metrics.find((metric) => metric.key === key)?.total ?? 0
          return { playerId: player.playerId, playerName: player.playerName, value, per90: player.per90[key] ?? null }
        })
        .filter((row) => row.value > 0)
        .sort((first, second) => second.value - first.value || first.playerName.localeCompare(second.playerName))
        .slice(0, 5),
    }
  })
  return { metrics, playerRows, leaderboards }
}

function setPlayerMap(target: Map<string, Map<FootballMetricKey, { successes: number; failures: number; count: number }>>, playerId: string) {
  const value = new Map<FootballMetricKey, { successes: number; failures: number; count: number }>()
  target.set(playerId, value)
  return value
}

function addMetricCount(target: Map<FootballMetricKey, { successes: number; failures: number; count: number }>, key: FootballMetricKey, outcome: Outcome) {
  const row = target.get(key) ?? { successes: 0, failures: 0, count: 0 }
  if (outcome === 'success') row.successes += 1
  else if (outcome === 'failure') row.failures += 1
  else row.count += 1
  target.set(key, row)
}

function buildMetricCount(key: FootballMetricKey, row: { successes: number; failures: number; count: number } | undefined, selectedOutcomes: Set<Outcome> | undefined): FootballMetricCount {
  const definition = definitionByKey.get(key)!
  const paired = pairedMetricKeys.has(key)
  const successes = row?.successes ?? 0
  const failures = row?.failures ?? 0
  const count = row?.count ?? 0
  const successOutcomeTracked = Boolean(selectedOutcomes?.has('success'))
  const failureOutcomeTracked = Boolean(selectedOutcomes?.has('failure'))
  const tracked = Boolean(selectedOutcomes && selectedOutcomes.size > 0)
  const attempts = paired && successOutcomeTracked && failureOutcomeTracked ? successes + failures : paired ? null : count + successes + failures
  const successRate = paired && attempts && attempts > 0 ? successes / attempts : null
  const total = paired ? successes + failures : count + successes + failures
  return {
    key,
    label: definition.label,
    attempts,
    successes: paired ? successes : null,
    failures: paired ? failures : null,
    total,
    successRate,
    tracked,
    successOutcomeTracked,
    failureOutcomeTracked,
    coverageLabel: getCoverageLabel({ tracked, total, paired, successOutcomeTracked, failureOutcomeTracked }),
  }
}

function getCoverageLabel(input: { tracked: boolean; total: number; paired: boolean; successOutcomeTracked: boolean; failureOutcomeTracked: boolean }) {
  if (!input.tracked) return 'Not tracked in setup'
  if (input.total === 0) return 'Tracked, zero recorded'
  if (input.paired && (!input.successOutcomeTracked || !input.failureOutcomeTracked)) return 'Count only; attempts and success percentage unavailable'
  return 'Tracked observations recorded'
}
