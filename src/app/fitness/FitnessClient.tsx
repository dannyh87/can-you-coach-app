'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useState } from 'react'

import Button from '@/components/ui/Button'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import { fieldClassName } from '@/components/ui/formStyles'

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
  fitnessTestTypes: FitnessTestTypeOption[]
  createFitnessTestSessionAction: FitnessAction
  deleteFitnessTestSessionAction: FitnessAction
}

export default function FitnessClient({
  sessions,
  teams,
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

  const openAddModal = () => {
    setSelectedSession(null)
    setError(null)
    setMessage(null)
    setModalMode('add')
  }

  const openDetailModal = (session: FitnessSessionRow) => {
    setSelectedSession(session)
    setError(null)
    setModalMode('detail')
  }

  const openDeleteModal = () => {
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
        <p className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total sessions" value={sessions.length} />
        <StatCard label="Live" value={liveCount} tone="warning" />
        <StatCard label="Completed" value={completedCount} tone="success" />
      </section>

      <SectionCard
        title="Fitness Test Sessions"
        description="Click a row to view details and available actions."
        actions={(
          <Button
            type="button"
            onClick={openAddModal}
          >
            Add Fitness Test Session
          </Button>
        )}
        bodyClassName="p-0"
      >

        <div className="border-b border-slate-100 p-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
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

            <label className="text-sm font-medium">
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

            <label className="text-sm font-medium">
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

            <label className="text-sm font-medium">
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <p>
              Showing {filteredAndSortedSessions.length} of {sessions.length} sessions.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-medium text-gray-700">
                Recording mode
                <select
                  value={recordingModeFilter}
                  onChange={(event) => setRecordingModeFilter(event.target.value)}
                  className="ml-2 rounded border p-2 text-sm font-normal text-gray-900"
                >
                  <option value="all">All</option>
                  {recordingModeFilterOptions.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No fitness test sessions yet.</p>
        ) : filteredAndSortedSessions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No fitness test sessions match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Test type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Results</th>
                  <th className="px-4 py-3 font-medium">Recording mode</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAndSortedSessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => openDetailModal(session)}
                    className="cursor-pointer hover:bg-blue-50/70"
                  >
                    <td className="px-4 py-3 text-gray-600">{session.dateDisplay}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {session.clubName} / {session.teamName}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {session.fitnessTestTypeName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${session.statusClasses}`}>
                        {session.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{session.resultCount}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {session.recordingModeLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {modalMode === 'add'
                    ? 'Add Fitness Test Session'
                    : modalMode === 'delete'
                      ? 'Confirm Delete Session'
                      : selectedSession?.fitnessTestTypeName ?? 'Fitness Session'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modalMode === 'delete'
                    ? 'Deletion is permanent and removes saved results for this session.'
                    : modalMode === 'detail'
                      ? selectedSession?.status === 'COMPLETED'
                        ? 'This completed session is locked and read-only.'
                        : 'View session details and choose the next action.'
                      : 'Create a session before recording fitness results.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded border px-3 py-1 text-sm font-medium"
                disabled={isSubmitting}
              >
                Close
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
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
                onDelete={openDeleteModal}
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
          </div>
        </div>
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
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">
        Team
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
      </label>

      <label className="text-sm font-medium">
        Test type
        <select
          name="fitnessTestTypeId"
          required
          defaultValue={fitnessTestTypes[0]?.id}
          className="mt-1 w-full rounded border p-2"
        >
          {fitnessTestTypes.map((fitnessTestType) => (
            <option key={fitnessTestType.id} value={fitnessTestType.id}>
              {fitnessTestType.name} ({fitnessTestType.resultUnit})
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Date
        <input
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        Notes
        <textarea
          name="notes"
          className="mt-1 w-full rounded border p-2"
          placeholder="Optional"
          rows={3}
        />
      </label>

      <div className="flex items-end md:col-span-2">
        <button
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Fitness Test Session'}
        </button>
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

      <div className="flex flex-wrap gap-2 pt-2">
        <SessionActions session={session} />
        {session.status !== 'IN_PROGRESS' && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded border px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Delete Session
          </button>
        )}
      </div>
    </div>
  )
}

function SessionActions({ session }: { session: FitnessSessionRow }) {
  if (session.status === 'COMPLETED') {
    return (
      <>
        <ActionLink href={`/fitness/sessions/${session.id}`} primary>
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
          <ActionLink href={`/fitness/sessions/${session.id}/live`} primary>
            Continue Live Dropout
          </ActionLink>
        )}
        {session.liveTimedFinish && (
          <ActionLink href={`/fitness/sessions/${session.id}/timer`} primary>
            Continue Live Timed Finish
          </ActionLink>
        )}
        {session.manualEntry && (
          <ActionLink href={`/fitness/sessions/${session.id}`} primary>
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
        <ActionLink href={`/fitness/sessions/${session.id}`} primary>
          Manual Entry
        </ActionLink>
      )}
        {session.liveDropout && (
          <ActionLink href={`/fitness/sessions/${session.id}/live`} primary>
            Start
          </ActionLink>
        )}
        {session.liveTimedFinish && (
          <ActionLink href={`/fitness/sessions/${session.id}/timer`} primary>
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

      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        This will permanently delete this fitness test session and its saved
        results. This action cannot be undone.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-4 py-2 text-sm font-medium"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Deleting...' : 'Confirm Delete Session'}
        </button>
      </div>
    </div>
  )
}

function ActionLink({
  href,
  primary,
  children,
}: {
  href: string
  primary?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white'
          : 'inline-flex rounded border px-4 py-2 text-sm font-medium'
      }
    >
      {children}
    </Link>
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
