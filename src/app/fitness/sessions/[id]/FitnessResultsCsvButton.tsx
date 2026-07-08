'use client'

import { downloadCsv } from '@/lib/csv'
import {
  buildFitnessResultsCsv,
  getFitnessCsvFilename,
  type FitnessCsvResult,
} from '@/lib/reportCsv'

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
    const metadata = {
      sessionName,
      dateLabel,
      teamName,
      clubName,
      testTypeName,
      sessionStatusLabel,
      dateForFilename,
    }

    downloadCsv(getFitnessCsvFilename(metadata), buildFitnessResultsCsv(metadata, results))
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
