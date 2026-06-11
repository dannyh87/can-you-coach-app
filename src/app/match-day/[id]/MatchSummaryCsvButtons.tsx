'use client'

import { buildCsv, downloadCsv, slugifyFilename } from '@/lib/csv'

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

type MatchSummaryCsvButtonsProps = {
  metadata: MatchCsvMetadata
  summaryRows: MatchSummaryCsvRow[]
  eventRows: MatchEventCsvRow[]
}

const summaryHeaders = [
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

const eventHeaders = [
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

export default function MatchSummaryCsvButtons({
  metadata,
  summaryRows,
  eventRows,
}: MatchSummaryCsvButtonsProps) {
  const baseFilename = `${slugifyFilename(metadata.teamName)}-vs-${slugifyFilename(
    metadata.opposition
  )}-${metadata.dateForFilename}`

  const downloadSummary = () => {
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

    downloadCsv(`match-summary-${baseFilename}.csv`, buildCsv(summaryHeaders, rows))
  }

  const downloadEvents = () => {
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

    downloadCsv(`match-events-${baseFilename}.csv`, buildCsv(eventHeaders, rows))
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={downloadSummary}
        className="inline-flex rounded border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
      >
        Download summary CSV
      </button>
      <button
        type="button"
        onClick={downloadEvents}
        className="inline-flex rounded border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
      >
        Download events CSV
      </button>
    </div>
  )
}
