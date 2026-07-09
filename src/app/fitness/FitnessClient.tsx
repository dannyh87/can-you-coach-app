'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import ActionLink from '@/components/ui/ActionLink'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  dataTableRowClassName,
} from '@/components/ui/DataTable'
import FormField from '@/components/ui/FormField'
import ModalShell from '@/components/ui/ModalShell'
import SectionCard from '@/components/ui/SectionCard'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'

type FitnessActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type FitnessAction = (formData: FormData) => Promise<FitnessActionResult>

type TeamOption = {
  id: string
  name: string
  clubName: string
}

type FitnessTestTypeOption = {
  id: string
  name: string
  resultUnit: string
  recordingModeLabel: string
}

type FitnessSessionRow = {
  id: string
  dateDisplay: string
  dateInput: string
  teamName: string
  clubName: string
  fitnessTestTypeName: string
  resultUnit: string
  higherIsBetter: boolean
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'
  statusLabel: string
  statusClasses: string
  startedAtDisplay: string
  completedAtDisplay: string
  notes: string | null
  resultCount: number
  recordingModeLabel: string
  manualEntry: boolean
  liveDropout: boolean
  liveTimedFinish: boolean
  canDelete: boolean
}

type ModalMode = 'add' | 'detail' | 'delete' | null
type FitnessSortOption =
  | 'newest'
  | 'oldest'
  | 'testTypeAsc'
  | 'teamAsc'
  | 'statusAsc'
  | 'mostResults'
  | 'fewestResults'

type FitnessClientProps = {
  sessions: FitnessSessionRow[]
  teams: TeamOption[]
  canCreateSessions: boolean
  fitnessTestTypes: FitnessTestTypeOption[]
  createFitnessTestSessionAction: FitnessAction
  deleteFitnessTestSessionAction: FitnessAction
}

export default function FitnessClient({
  sessions,
  teams,
  canCreateSessions,
  fitnessTestTypes,
  createFitnessTestSessionAction,
  deleteFitnessTestSessionAction,
}: FitnessClientProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedSession, setSelectedSession] = useState<FitnessSessionRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [testTypeFilter, setTestTypeFilter] = useState('all')
  const [recordingModeFilter, setRecordingModeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<FitnessSortOption>('newest')
  const liveCount = sessions.filter((session) => session.status === 'IN_PROGRESS').length
  const completedCount = sessions.filter((session) => session.status === 'COMPLETED').length
  const draftCount = sessions.filter((session) => session.status === 'DRAFT').length
  const teamFilterOptions = Array.from(
    new Set(sessions.map((session) => `${session.clubName} / ${session.teamName}`))
  ).sort((a, b) => a.localeCompare(b))
  const testTypeFilterOptions = Array.from(
    new Set(sessions.map((session) => session.fitnessTestTypeName))
  ).sort((a, b) => a.localeCompare(b))
  const recordingModeFilterOptions = Array.from(
    new Set(sessions.map((session) => session.recordingModeLabel))
  ).sort((a, b) => a.localeCompare(b))
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const filteredSessions = sessions.filter((session) => {
    const teamLabel = `${session.clubName} / ${session.teamName}`
    const searchableText = [
      session.fitnessTestTypeName,
      session.teamName,
      session.clubName,
      session.notes ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return (
      (!normalizedSearchTerm || searchableText.includes(normalizedSearchTerm)) &&
      (statusFilter === 'all' || session.status === statusFilter) &&
      (teamFilter === 'all' || teamLabel === teamFilter) &&
      (testTypeFilter === 'all' || session.fitnessTestTypeName === testTypeFilter) &&
      (recordingModeFilter === 'all' ||
        session.recordingModeLabel === recordingModeFilter)
    )
  })
  const filteredAndSortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortBy === 'oldest') return a.dateInput.localeCompare(b.dateInput)
    if (sortBy === 'testTypeAsc') {
      return a.fitnessTestTypeName.localeCompare(b.fitnessTestTypeName)
    }
    if (sortBy === 'teamAsc') {
      return `${a.clubName} / ${a.teamName}`.localeCompare(
        `${b.clubName} / ${b.teamName}`
      )
    }
    if (sortBy === 'statusAsc') return a.statusLabel.localeCompare(b.statusLabel)
    if (sortBy === 'mostResults') return b.resultCount - a.resultCount
    if (sortBy === 'fewestResults') return a.resultCount - b.resultCount

    return b.dateInput.localeCompare(a.dateInput)
  })
  const hasActiveFilters =
    Boolean(normalizedSearchTerm) ||
    statusFilter !== 'all' ||
    teamFilter !== 'all' ||
    testTypeFilter !== 'all' ||
    recordingModeFilter !== 'all' ||
    sortBy !== 'newest'

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setTeamFilter('all')
    setTestTypeFilter('all')
    setRecordingModeFilter('all')
    setSortBy('newest')
  }

  const showCompletedResults = () => {
    setSearchTerm('')
    setStatusFilter('COMPLETED')
    setTeamFilter('all')
    setTestTypeFilter('all')
    setRecordingModeFilter('all')
    setSortBy('newest')
  }

  const openDetailModal = (session: FitnessSessionRow) => {
    setSelectedSession(session)
    setError(null)
    setModalMode('detail')
  }

  const openDeleteModal = (session?: FitnessSessionRow) => {
    if (session) setSelectedSession(session)
    setError(null)
    setModalMode('delete')
  }

  const returnToDetailModal = () => {
    if (isSubmitting) return
    setError(null)
    setModalMode('detail')
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedSession(null)
    setError(null)
  }

  const createSession = async (formData: FormData) => {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const result = await createFitnessTestSessionAction(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedSession(null)
      setMessage('Fitness test session created.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  const deleteSession = async () => {
    if (!selectedSession) return

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', selectedSession.id)

    const result = await deleteFitnessTestSessionAction(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedSession(null)
      setMessage('Fitness test session deleted.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  return (
    <>
      {message && (
        <Alert variant="success" className="mb-6">{message}</Alert>
      )}

      <section className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-950 to-slate-950 p-4 text-white shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Fitness tasks</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">What do you need to do?</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[620px]">
            {canCreateSessions ? (
              <ActionLink href="/fitness/sessions/new" variant="secondary" size="lg" className="bg-white text-blue-950 hover:bg-blue-50">
                Start Fitness Test
              </ActionLink>
            ) : (
              <span className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white">
                Coach-created tests only
              </span>
            )}
            <Button type="button" onClick={showCompletedResults} variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              View Results
            </Button>
            <ActionLink href="/fitness/progress" variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              View Progress
            </ActionLink>
            <ActionLink href="/fitness/test-types" variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              Test Library
            </ActionLink>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-blue-950">
          <span className="rounded-full bg-white px-3 py-1">Sessions {sessions.length}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1">Live {liveCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Created {draftCount}</span>
          <span className="rounded-full bg-green-100 px-3 py-1">Completed {completedCount}</span>
        </div>
      </section>

      <SectionCard
        title="Fitness Sessions"
        description="Continue live tests or review completed results."
        actions={canCreateSessions ? (
          <ActionLink href="/fitness/sessions/new" variant="primary" size="sm">
            Start Fitness Test
          </ActionLink>
        ) : undefined}
        bodyClassName="p-0"
      >

        <div className="border-b border-slate-100 bg-slate-50/60 p-3 sm:p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
            <label className="text-sm font-medium lg:col-span-2">
              Search
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={fieldClassName}
                placeholder="Team, test type or notes"
              />
            </label>

            <label className="text-sm font-medium">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={fieldClassName}
              >
                <option value="all">All statuses</option>
                <option value="DRAFT">Created</option>
                <option value="IN_PROGRESS">Live</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <p>
              Showing {filteredAndSortedSessions.length} of {sessions.length} sessions.
            </p>
            <details className="w-full rounded-xl border border-slate-200 bg-white p-3 md:w-auto md:min-w-[360px]">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                More filters
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Team
                  <select
                    value={teamFilter}
                    onChange={(event) => setTeamFilter(event.target.value)}
                    className={fieldClassName}
                  >
                    <option value="all">All teams</option>
                    {teamFilterOptions.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Test type
                  <select
                    value={testTypeFilter}
                    onChange={(event) => setTestTypeFilter(event.target.value)}
                    className={fieldClassName}
                  >
                    <option value="all">All test types</option>
                    {testTypeFilterOptions.map((testType) => (
                      <option key={testType} value={testType}>
                        {testType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Recording mode
                  <select
                    value={recordingModeFilter}
                    onChange={(event) => setRecordingModeFilter(event.target.value)}
                    className={fieldClassName}
                  >
                    <option value="all">All modes</option>
                    {recordingModeFilterOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Sort
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as FitnessSortOption)}
                    className={fieldClassName}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="testTypeAsc">Test type A-Z</option>
                    <option value="teamAsc">Team A-Z</option>
                    <option value="statusAsc">Status</option>
                    <option value="mostResults">Most results</option>
                    <option value="fewestResults">Fewest results</option>
                  </select>
                </label>
              </div>
            </details>
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No fitness test sessions yet.</p>
        ) : filteredAndSortedSessions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No fitness test sessions match these filters.
          </p>
        ) : (
          <>
          <div className="divide-y md:hidden">
            {filteredAndSortedSessions.map((session) => (
              <article key={session.id} className="p-4">
                <button
                  type="button"
                  onClick={() => openDetailModal(session)}
                  className="block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold">{session.fitnessTestTypeName}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {session.clubName} / {session.teamName}
                      </p>
                    </div>
                    <StatusBadge label={session.statusLabel} variant={getStatusBadgeVariant(session.statusLabel)} />
                  </div>
                  <dl className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <div className="rounded-full bg-slate-100 px-3 py-1">
                      <dt className="sr-only">Date</dt>
                      <dd>{session.dateDisplay}</dd>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1">
                      <dt className="sr-only">Results</dt>
                      <dd>{session.resultCount} results</dd>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1">
                      <dt className="sr-only">Recording mode</dt>
                      <dd>{session.recordingModeLabel}</dd>
                    </div>
                  </dl>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SessionActions session={session} />
                  {session.canDelete && (
                    <button
                      type="button"
                      onClick={() => openDeleteModal(session)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <DataTable className="min-w-[920px]">
              <DataTableHead>
                <tr>
                  <DataTableHeader>Date</DataTableHeader>
                  <DataTableHeader>Team</DataTableHeader>
                  <DataTableHeader>Test type</DataTableHeader>
                  <DataTableHeader>Status</DataTableHeader>
                  <DataTableHeader>Results</DataTableHeader>
                  <DataTableHeader>Recording mode</DataTableHeader>
                  <DataTableHeader>Action</DataTableHeader>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filteredAndSortedSessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => openDetailModal(session)}
                    className={dataTableRowClassName(true)}
                  >
                    <DataTableCell>{session.dateDisplay}</DataTableCell>
                    <DataTableCell>
                      {session.clubName} / {session.teamName}
                    </DataTableCell>
                    <DataTableCell className="font-medium text-slate-950">
                      {session.fitnessTestTypeName}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge label={session.statusLabel} variant={getStatusBadgeVariant(session.statusLabel)} />
                    </DataTableCell>
                    <DataTableCell>{session.resultCount}</DataTableCell>
                    <DataTableCell>
                      {session.recordingModeLabel}
                    </DataTableCell>
                    <DataTableCell>
                      {session.canDelete ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openDeleteModal(session)
                          }}
                          className="text-sm font-bold text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </DataTableCell>
                  </tr>
                ))}
              </DataTableBody>
          </DataTable>
          </>
        )}
      </SectionCard>

      {modalMode && (
        <ModalShell
          title={modalMode === 'add'
            ? 'Start Fitness Test'
            : modalMode === 'delete'
              ? 'Confirm Delete Session'
              : selectedSession?.fitnessTestTypeName ?? 'Fitness Session'}
          description={modalMode === 'delete'
            ? 'Deletion is permanent and removes saved results for this session.'
            : modalMode === 'detail'
              ? selectedSession?.status === 'COMPLETED'
                ? 'This completed session is locked and read-only.'
                : 'View session details and choose the next action.'
              : 'Create a session before recording fitness results.'}
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode={modalMode === 'delete' ? 'danger' : modalMode === 'add' ? 'create' : 'detail'}
        >
            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            {modalMode === 'add' && (
              <CreateSessionForm
                teams={teams}
                fitnessTestTypes={fitnessTestTypes}
                isSubmitting={isSubmitting}
                onSubmit={createSession}
              />
            )}

            {modalMode === 'detail' && selectedSession && (
              <SessionDetail
                session={selectedSession}
                isSubmitting={isSubmitting}
                onDelete={() => openDeleteModal()}
              />
            )}

            {modalMode === 'delete' && selectedSession && (
              <DeleteSessionConfirmation
                session={selectedSession}
                isSubmitting={isSubmitting}
                onCancel={returnToDetailModal}
                onConfirm={deleteSession}
              />
            )}
        </ModalShell>
      )}
    </>
  )
}

function CreateSessionForm({
  teams,
  fitnessTestTypes,
  isSubmitting,
  onSubmit,
}: {
  teams: TeamOption[]
  fitnessTestTypes: FitnessTestTypeOption[]
  isSubmitting: boolean
  onSubmit: (formData: FormData) => Promise<void>
}) {
  return (
    <form action={onSubmit} className={formGridClassName}>
      <FormField label="Team">
        <select
          name="teamId"
          required
          defaultValue={teams[0]?.id}
          className="mt-1 w-full rounded border p-2"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.clubName} - {team.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Test type">
        <select
          name="fitnessTestTypeId"
          required
          defaultValue={fitnessTestTypes[0]?.id}
          className="mt-1 w-full rounded border p-2"
        >
          {fitnessTestTypes.map((fitnessTestType) => (
            <option key={fitnessTestType.id} value={fitnessTestType.id}>
              {fitnessTestType.name} ({fitnessTestType.resultUnit}) -{' '}
              {fitnessTestType.recordingModeLabel}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Date">
        <input
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
          className="mt-1 w-full rounded border p-2"
        />
      </FormField>

      <FormField label="Notes" className="md:col-span-2">
        <textarea
          name="notes"
          className="mt-1 w-full rounded border p-2"
          placeholder="Optional"
          rows={3}
        />
      </FormField>

      <div className="flex items-end md:col-span-2">
        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Fitness Test Session'}
        </Button>
      </div>
    </form>
  )
}

function SessionDetail({
  session,
  isSubmitting,
  onDelete,
}: {
  session: FitnessSessionRow
  isSubmitting: boolean
  onDelete: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Test type" value={session.fitnessTestTypeName} />
        <DetailItem label="Team" value={`${session.clubName} / ${session.teamName}`} />
        <DetailItem label="Date" value={session.dateDisplay} />
        <div className="rounded-lg border p-4">
          <dt className="text-sm text-gray-500">Status</dt>
          <dd className="mt-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${session.statusClasses}`}>
              {session.statusLabel}
            </span>
          </dd>
        </div>
        <DetailItem label="Started" value={session.startedAtDisplay} />
        <DetailItem label="Completed" value={session.completedAtDisplay} />
        <DetailItem label="Result count" value={String(session.resultCount)} />
        <DetailItem label="Recording mode" value={session.recordingModeLabel} />
      </div>

      {session.notes && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          {session.notes}
        </p>
      )}

      {session.status === 'COMPLETED' && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-900">
          Locked and read-only. Results can be reviewed, exported from the results page,
          and compared in rankings or progress.
        </p>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Next actions
        </h3>
        <p className="mt-1 text-sm text-blue-900">
          {session.status === 'COMPLETED'
            ? 'Review locked results, rankings or progress.'
            : 'Continue recording with the available mode for this test.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
        <SessionActions session={session} />
        </div>
      </div>

        {session.canDelete && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-red-700">
            Session admin
          </h3>
          <p className="mt-1 text-sm text-red-700">
            Delete removes this session and saved results. Use only outside live recording.
          </p>
          <Button
            type="button"
            onClick={onDelete}
            variant="secondary"
            className="mt-3 border-red-200 text-red-700"
            disabled={isSubmitting}
          >
            Delete Session
          </Button>
        </div>
        )}
    </div>
  )
}

function SessionActions({ session }: { session: FitnessSessionRow }) {
  if (session.status === 'COMPLETED') {
    return (
      <>
        <ActionLink href={`/fitness/sessions/${session.id}`} variant="primary">
          View Locked Results
        </ActionLink>
        <ActionLink href={`/fitness/sessions/${session.id}/rankings`}>
          Rankings
        </ActionLink>
        <ActionLink href="/fitness/progress">Progress</ActionLink>
      </>
    )
  }

  if (session.status === 'IN_PROGRESS') {
    return (
      <>
        {session.liveDropout && (
          <ActionLink href={`/fitness/sessions/${session.id}/live`} variant="primary">
            Continue Live Dropout
          </ActionLink>
        )}
        {session.liveTimedFinish && (
          <ActionLink href={`/fitness/sessions/${session.id}/timer`} variant="primary">
            Continue Live Timed Finish
          </ActionLink>
        )}
        {session.manualEntry && (
          <ActionLink href={`/fitness/sessions/${session.id}`} variant="primary">
            Manual Entry
          </ActionLink>
        )}
        <ActionLink href={`/fitness/sessions/${session.id}/rankings`}>
          Rankings
        </ActionLink>
      </>
    )
  }

  return (
    <>
      {session.manualEntry && (
        <ActionLink href={`/fitness/sessions/${session.id}`} variant="primary">
          Manual Entry
        </ActionLink>
      )}
        {session.liveDropout && (
          <ActionLink href={`/fitness/sessions/${session.id}/live`} variant="primary">
            Start
          </ActionLink>
        )}
        {session.liveTimedFinish && (
          <ActionLink href={`/fitness/sessions/${session.id}/timer`} variant="primary">
            Start
          </ActionLink>
        )}
      <ActionLink href={`/fitness/sessions/${session.id}/rankings`}>
        Rankings
      </ActionLink>
    </>
  )
}

function DeleteSessionConfirmation({
  session,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  session: FitnessSessionRow
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-bold">{session.fitnessTestTypeName}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {session.clubName} / {session.teamName} - {session.dateDisplay}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailItem label="Status" value={session.statusLabel} />
          <DetailItem label="Result count" value={String(session.resultCount)} />
        </dl>
      </div>

      <Alert variant="error">
        Delete this fitness test session? This will permanently remove recorded results for this session.
        This action cannot be undone.
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          variant="danger"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Deleting...' : 'Confirm Delete Session'}
        </Button>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  )
}
