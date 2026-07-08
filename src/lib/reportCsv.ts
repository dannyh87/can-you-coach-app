import { buildCsv, slugifyFilename } from '@/lib/csv'

export type MatchCsvMetadata = {
  match: string
  dateLabel: string
  dateForFilename: string
  teamName: string
  opposition: string
  venue: string
  matchType: string
  finalScore: string
}

export type MatchSummaryCsvRow = {
  playerName: string
  squadNumber: number | null
  squadStatus: string
  trackedForEvents: boolean
  minutesPlayed: number
  totalEvents: number
  goals: number
  assists: number
  shotsOnTarget: number
  shotsOffTarget: number
  passComplete: number
  passIncomplete: number
  oneVOneSuccess: number
  oneVOneUnsuccessful: number
}

export type MatchEventCsvRow = {
  half: string
  matchTime: string
  playerName: string
  event: string
  scoreAtTime: string
}

export type FitnessCsvResult = {
  playerName: string
  squadNumber: number | null
  result: string
  resultValue: number | null
  resultStatus: string
  rank: number | null
  notes: string | null
}

export type FitnessCsvMetadata = {
  sessionName: string
  dateLabel: string
  dateForFilename: string
  teamName: string
  clubName: string
  testTypeName: string
  sessionStatusLabel: string
}

const matchSummaryHeaders = [
  'Match',
  'Date',
  'Team',
  'Opposition',
  'Venue',
  'Match Type',
  'Final Score',
  'Player',
  'Squad Number',
  'Squad Status',
  'Tracked For Events',
  'Minutes Played',
  'Total Events',
  'Goals',
  'Assists',
  'Shots On Target',
  'Shots Off Target',
  'Pass Complete',
  'Pass Incomplete',
  '1v1 Success',
  '1v1 Unsuccessful',
]

const matchEventHeaders = [
  'Match',
  'Date',
  'Team',
  'Opposition',
  'Venue',
  'Match Type',
  'Final Score',
  'Half',
  'Match Time',
  'Player',
  'Event',
  'Score At Time',
]

const fitnessHeaders = [
  'Session',
  'Date',
  'Team',
  'Club',
  'Test Type',
  'Status',
  'Player',
  'Squad Number',
  'Result',
  'Result Value',
  'Result Status',
  'Rank',
  'Notes',
]

export const getMatchCsvBaseFilename = (metadata: MatchCsvMetadata) =>
  `${slugifyFilename(metadata.teamName)}-vs-${slugifyFilename(
    metadata.opposition
  )}-${metadata.dateForFilename}`

export const getFitnessCsvFilename = (metadata: FitnessCsvMetadata) =>
  `fitness-results-${slugifyFilename(metadata.testTypeName)}-${slugifyFilename(
    metadata.teamName
  )}-${metadata.dateForFilename}.csv`

export const buildMatchSummaryCsv = (
  metadata: MatchCsvMetadata,
  summaryRows: MatchSummaryCsvRow[]
) => {
  const rows = summaryRows.map((row) => [
    metadata.match,
    metadata.dateLabel,
    metadata.teamName,
    metadata.opposition,
    metadata.venue,
    metadata.matchType,
    metadata.finalScore,
    row.playerName,
    row.squadNumber ?? '',
    row.squadStatus,
    row.trackedForEvents ? 'Yes' : 'No',
    row.minutesPlayed,
    row.totalEvents,
    row.goals,
    row.assists,
    row.shotsOnTarget,
    row.shotsOffTarget,
    row.passComplete,
    row.passIncomplete,
    row.oneVOneSuccess,
    row.oneVOneUnsuccessful,
  ])

  return buildCsv(matchSummaryHeaders, rows)
}

export const buildMatchEventsCsv = (
  metadata: MatchCsvMetadata,
  eventRows: MatchEventCsvRow[]
) => {
  const rows = eventRows.map((row) => [
    metadata.match,
    metadata.dateLabel,
    metadata.teamName,
    metadata.opposition,
    metadata.venue,
    metadata.matchType,
    metadata.finalScore,
    row.half,
    row.matchTime,
    row.playerName,
    row.event,
    row.scoreAtTime,
  ])

  return buildCsv(matchEventHeaders, rows)
}

export const buildFitnessResultsCsv = (
  metadata: FitnessCsvMetadata,
  results: FitnessCsvResult[]
) => {
  const rows = results.map((result) => [
    metadata.sessionName,
    metadata.dateLabel,
    metadata.teamName,
    metadata.clubName,
    metadata.testTypeName,
    metadata.sessionStatusLabel,
    result.playerName,
    result.squadNumber ?? '',
    result.result,
    result.resultValue ?? '',
    result.resultStatus,
    result.rank ?? '',
    result.notes ?? '',
  ])

  return buildCsv(fitnessHeaders, rows)
}
