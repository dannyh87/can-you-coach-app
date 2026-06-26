'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
} from '@/components/ui/DataTable'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName } from '@/components/ui/formStyles'

type TeamOption = {
  id: string
  name: string
  clubName: string
}

type PreviewRow = {
  rowNumber: number
  firstName: string
  surname: string
  squadNumber: number | null
  position: string
  dateOfBirth: string
  errors: string[]
  warnings: string[]
}

type PreviewResult =
  | { ok: true; rows: PreviewRow[]; validCount: number; invalidCount: number; warningCount: number }
  | { ok: false; reason: string }

type ConfirmResult =
  | { ok: true; importedCount: number; skippedCount: number; errorCount: number }
  | { ok: false; reason: string }

type PlayerImportClientProps = {
  teams: TeamOption[]
  template: string
  previewPlayerImportAction: (formData: FormData) => Promise<PreviewResult>
  confirmPlayerImportAction: (formData: FormData) => Promise<ConfirmResult>
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? '' : String(squadNumber)

export default function PlayerImportClient({
  teams,
  template,
  previewPlayerImportAction,
  confirmPlayerImportAction,
}: PlayerImportClientProps) {
  const router = useRouter()
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [csvText, setCsvText] = useState(template)
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Extract<ConfirmResult, { ok: true }> | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const selectedTeam = teams.find((team) => team.id === teamId)

  const buildFormData = () => {
    const formData = new FormData()
    formData.set('teamId', teamId)
    formData.set('csvText', csvText)
    return formData
  }

  const previewImport = async () => {
    setIsPreviewing(true)
    setError(null)
    setSummary(null)

    const result = await previewPlayerImportAction(buildFormData())
    if (result.ok) {
      setPreview(result)
    } else {
      setPreview(null)
      setError(result.reason)
    }

    setIsPreviewing(false)
  }

  const confirmImport = async () => {
    setIsImporting(true)
    setError(null)
    setSummary(null)

    const result = await confirmPlayerImportAction(buildFormData())
    if (result.ok) {
      setSummary(result)
      setPreview(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsImporting(false)
  }

  const copyTemplate = async () => {
    await navigator.clipboard.writeText(template)
  }

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'player-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {summary && (
        <Alert variant="success">
          Imported {summary.importedCount} player{summary.importedCount === 1 ? '' : 's'}. Skipped {summary.skippedCount} row{summary.skippedCount === 1 ? '' : 's'} with errors.
        </Alert>
      )}

      <SectionCard
        title="1. Choose team and paste CSV"
        description="Position is optional for imports. Dates work best as YYYY-MM-DD. V1 imports up to 100 rows."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Team
              <select
                value={teamId}
                onChange={(event) => {
                  setTeamId(event.target.value)
                  setPreview(null)
                  setSummary(null)
                }}
                className={fieldClassName}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.clubName} - {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              CSV data
              <textarea
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value)
                  setPreview(null)
                  setSummary(null)
                }}
                rows={12}
                className={`${fieldClassName} font-mono text-xs`}
                spellCheck={false}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={previewImport} disabled={isPreviewing || isImporting || !teamId}>
                {isPreviewing ? 'Previewing...' : 'Preview import'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCsvText(template)} disabled={isPreviewing || isImporting}>
                Reset template
              </Button>
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="font-bold text-slate-950">CSV template</h2>
            <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-800">{template}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={copyTemplate}>
                Copy template
              </Button>
              <Button type="button" variant="secondary" onClick={downloadTemplate}>
                Download CSV
              </Button>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Headers can use common alternatives like First Name, Last Name, Squad Number, shirtNumber and DOB.
            </p>
          </aside>
        </div>
      </SectionCard>

      {preview && (
        <SectionCard
          title="2. Preview and confirm"
          description={`Importing into ${selectedTeam ? `${selectedTeam.clubName} / ${selectedTeam.name}` : 'selected team'}. Invalid rows will be skipped.`}
          actions={(
            <Button type="button" onClick={confirmImport} disabled={isImporting || preview.validCount === 0}>
              {isImporting ? 'Importing...' : `Import ${preview.validCount} valid row${preview.validCount === 1 ? '' : 's'}`}
            </Button>
          )}
          bodyClassName="p-0"
        >
          <div className="grid gap-2 border-b border-slate-100 p-4 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-3 font-bold text-green-800">{preview.validCount} valid</div>
            <div className="rounded-lg bg-red-50 p-3 font-bold text-red-800">{preview.invalidCount} invalid</div>
            <div className="rounded-lg bg-amber-50 p-3 font-bold text-amber-900">{preview.warningCount} with warnings</div>
          </div>

          <DataTable className="min-w-[980px]">
            <DataTableHead>
              <tr>
                <DataTableHeader>Row</DataTableHeader>
                <DataTableHeader>First name</DataTableHeader>
                <DataTableHeader>Surname</DataTableHeader>
                <DataTableHeader>Squad No.</DataTableHeader>
                <DataTableHeader>Position</DataTableHeader>
                <DataTableHeader>Date of birth</DataTableHeader>
                <DataTableHeader>Status</DataTableHeader>
                <DataTableHeader>Messages</DataTableHeader>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {preview.rows.map((row) => {
                const isValid = row.errors.length === 0

                return (
                  <tr key={row.rowNumber} className={isValid ? 'bg-white' : 'bg-red-50/60'}>
                    <DataTableCell>{row.rowNumber}</DataTableCell>
                    <DataTableCell className="font-medium text-slate-950">{row.firstName}</DataTableCell>
                    <DataTableCell className="font-medium text-slate-950">{row.surname}</DataTableCell>
                    <DataTableCell>{formatSquadNumber(row.squadNumber)}</DataTableCell>
                    <DataTableCell>{row.position}</DataTableCell>
                    <DataTableCell>{row.dateOfBirth}</DataTableCell>
                    <DataTableCell>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isValid ? 'Valid' : 'Skipped'}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="space-y-1 text-sm">
                        {row.errors.map((message) => (
                          <p key={message} className="font-semibold text-red-700">{message}</p>
                        ))}
                        {row.warnings.map((message) => (
                          <p key={message} className="font-semibold text-amber-700">{message}</p>
                        ))}
                        {row.errors.length === 0 && row.warnings.length === 0 && (
                          <p className="text-slate-500">Ready to import.</p>
                        )}
                      </div>
                    </DataTableCell>
                  </tr>
                )
              })}
            </DataTableBody>
          </DataTable>
        </SectionCard>
      )}
    </div>
  )
}
