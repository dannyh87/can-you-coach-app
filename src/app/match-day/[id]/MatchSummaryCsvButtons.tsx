'use client'

import { downloadCsv } from '@/lib/csv'
import {
  buildMatchEventsCsv,
  buildMatchPatternObservationsCsv,
  buildMatchSummaryCsv,
  getMatchCsvBaseFilename,
  type MatchCsvMetadata,
  type MatchEventCsvRow,
  type MatchPatternObservationCsvRow,
  type MatchSummaryCsvRow,
} from '@/lib/reportCsv'

type MatchSummaryCsvButtonsProps = {
  metadata: MatchCsvMetadata
  summaryRows: MatchSummaryCsvRow[]
  eventRows: MatchEventCsvRow[]
  patternRows: MatchPatternObservationCsvRow[]
}

export default function MatchSummaryCsvButtons({
  metadata,
  summaryRows,
  eventRows,
  patternRows,
}: MatchSummaryCsvButtonsProps) {
  const baseFilename = getMatchCsvBaseFilename(metadata)

  const downloadSummary = () => {
    downloadCsv(`match-summary-${baseFilename}.csv`, buildMatchSummaryCsv(metadata, summaryRows))
  }

  const downloadEvents = () => {
    downloadCsv(`match-events-${baseFilename}.csv`, buildMatchEventsCsv(metadata, eventRows))
  }

  const downloadPatterns = () => {
    downloadCsv(`match-pattern-observations-${baseFilename}.csv`, buildMatchPatternObservationsCsv(metadata, patternRows))
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
      <button
        type="button"
        onClick={downloadPatterns}
        className="inline-flex rounded border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
      >
        Download pattern CSV
      </button>
    </div>
  )
}
