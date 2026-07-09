'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type DragEvent } from 'react'

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

const excelFileExtensions = ['.xlsx', '.xls']

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const getFileExtension = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase()
}

const isCsvFile = (file: File) => {
  const extension = getFileExtension(file.name)
  return extension === '.csv' && (!file.type || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel')
}

const isExcelFile = (file: File) => excelFileExtensions.includes(getFileExtension(file.name))

export default function PlayerImportClient({
  teams,
  template,
  previewPlayerImportAction,
  confirmPlayerImportAction,
}: PlayerImportClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [csvText, setCsvText] = useState(template)
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
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

  const clearImportState = () => {
    setPreview(null)
    setSummary(null)
  }

  const handleImportFile = async (file: File | null) => {
    setError(null)
    clearImportState()

    if (!file) return

    if (isExcelFile(file)) {
      setSelectedFile(null)
      setError('Excel import is not available yet. Please export or save your spreadsheet as a CSV file and upload that instead.')
      return
    }

    if (!isCsvFile(file)) {
      setSelectedFile(null)
      setError('Please upload a CSV file.')
      return
    }

    try {
      const text = await file.text()
      if (!text.trim()) {
        setSelectedFile(null)
        setError('The selected CSV file is empty.')
        return
      }

      setSelectedFile({ name: file.name, size: file.size })
      setCsvText(text)
    } catch {
      setSelectedFile(null)
      setError('The selected file could not be read. Please check the file and try again.')
    }
  }

  const removeSelectedFile = () => {
    setSelectedFile(null)
    clearImportState()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingFile(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFile(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingFile(false)
    void handleImportFile(event.dataTransfer.files[0] ?? null)
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
        title="1. Choose team and add CSV"
        description="Drag in a CSV, choose a file, or paste CSV manually. Position is optional. Dates work best as YYYY-MM-DD. V1 imports up to 100 rows."
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

            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-5 text-center transition sm:p-6 ${
                isDraggingFile
                  ? 'border-blue-700 bg-blue-50 ring-4 ring-blue-100'
                  : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  void handleImportFile(event.target.files?.[0] ?? null)
                }}
              />
              <div className="mx-auto max-w-md">
                <p className="text-base font-bold text-slate-950">
                  Drag and drop a CSV file here, or click to choose a file.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Using Excel? Export or save your spreadsheet as CSV first.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="secondary" onClick={openFilePicker} disabled={isPreviewing || isImporting}>
                    Choose CSV file
                  </Button>
                  {selectedFile && (
                    <Button type="button" variant="ghost" onClick={removeSelectedFile} disabled={isPreviewing || isImporting}>
                      Remove file
                    </Button>
                  )}
                </div>
                {selectedFile && (
                  <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
            </div>

            <details className="rounded-xl border border-slate-200 bg-white p-4" open={!selectedFile}>
              <summary className="cursor-pointer text-sm font-bold text-slate-800">
                Paste or edit CSV manually
              </summary>
              <label className="mt-4 block text-sm font-medium">
                CSV data
                <textarea
                  value={csvText}
                  onChange={(event) => {
                    setCsvText(event.target.value)
                    clearImportState()
                  }}
                  rows={12}
                  className={`${fieldClassName} font-mono text-xs`}
                  spellCheck={false}
                />
              </label>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={previewImport} disabled={isPreviewing || isImporting || !teamId || !csvText.trim()}>
                {isPreviewing ? 'Previewing...' : 'Preview import'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => {
                setCsvText(template)
                setSelectedFile(null)
                clearImportState()
              }} disabled={isPreviewing || isImporting}>
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
              Accepted columns: firstName, surname, name, squadNumber, position and dateOfBirth. Headers can use common alternatives like First Name, Last Name, Squad Number, shirtNumber and DOB.
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
