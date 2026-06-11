'use client'

import { buildCsv, downloadCsv, slugifyFilename } from '@/lib/csv'

type FitnessCsvResult = {
  playerName: string
  squadNumber: number | null
  result: string
  resultValue: number | null
  resultStatus: string
  rank: number | null
  notes: string | null
}

type FitnessResultsCsvButtonProps = {
  sessionName: string
  dateLabel: string
  dateForFilename: string
  teamName: string
  clubName: string
  testTypeName: string
  sessionStatusLabel: string
  results: FitnessCsvResult[]
}

const headers = [
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

export default function FitnessResultsCsvButton({
  sessionName,
  dateLabel,
  dateForFilename,
  teamName,
  clubName,
  testTypeName,
  sessionStatusLabel,
  results,
}: FitnessResultsCsvButtonProps) {
  const downloadResults = () => {
    const rows = results.map((result) => [
      sessionName,
      dateLabel,
      teamName,
      clubName,
      testTypeName,
      sessionStatusLabel,
      result.playerName,
      result.squadNumber ?? '',
      result.result,
      result.resultValue ?? '',
      result.resultStatus,
      result.rank ?? '',
      result.notes ?? '',
    ])
    const csvContent = buildCsv(headers, rows)
    const filename = `fitness-results-${slugifyFilename(testTypeName)}-${slugifyFilename(
      teamName
    )}-${dateForFilename}.csv`

    downloadCsv(filename, csvContent)
  }

  return (
    <button
      type="button"
      onClick={downloadResults}
      className="inline-flex rounded border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
    >
      Download results CSV
    </button>
  )
}
