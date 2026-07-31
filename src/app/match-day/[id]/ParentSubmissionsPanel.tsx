"use client"

import { useMemo, useState } from 'react'

import ParentSubmissionReviewActions from '@/app/match-day/[id]/ParentSubmissionReviewActions'

type ReviewActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type ParentSubmissionRow = {
  id: string
  type: 'event' | 'pattern'
  playerName: string
  squadNumber: number | null
  eventLabel: string
  detailLabel: string | null
  submitterLabel: string
  halfLabel: string
  matchTime: string
  statusLabel: string
  status: 'PENDING' | 'ACCEPTED' | 'IGNORED'
  createdAt: string
  createdAtLabel: string
  reviewedAtLabel: string | null
  reviewedByLabel: string | null
  note: string | null
  hasLocation: boolean
}

type ParentSubmissionsPanelProps = {
  matchDayId: string
  matchStatus: 'DRAFT' | 'IN_PROGRESS' | 'HALF_TIME' | 'COMPLETED'
  submissions: ParentSubmissionRow[]
  pendingCount: number
  canReview: boolean
  acceptParentSubmissionAction: (formData: FormData) => Promise<ReviewActionResult>
  ignoreParentSubmissionAction: (formData: FormData) => Promise<ReviewActionResult>
  reviewPatternSubmissionAction: (formData: FormData) => Promise<ReviewActionResult>
  defaultOpen?: boolean
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const getStatusClasses = (status: ParentSubmissionRow['status']) => {
  if (status === 'ACCEPTED') return 'bg-green-100 text-green-800'
  if (status === 'IGNORED') return 'bg-slate-100 text-slate-700'
  return 'bg-amber-100 text-amber-900'
}

export default function ParentSubmissionsPanel({
  matchDayId,
  matchStatus,
  submissions,
  pendingCount,
  canReview,
  acceptParentSubmissionAction,
  ignoreParentSubmissionAction,
  reviewPatternSubmissionAction,
  defaultOpen = false,
}: ParentSubmissionsPanelProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'event' | 'pattern'>('all')
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ACCEPTED' | 'IGNORED' | 'all'>('PENDING')
  const [textFilter, setTextFilter] = useState('')
  const visibleSubmissions = useMemo(() => {
    const query = textFilter.toLowerCase().trim()
    return submissions.filter((submission) => {
      if (typeFilter !== 'all' && submission.type !== typeFilter) return false
      if (statusFilter !== 'all' && submission.status !== statusFilter) return false
      if (!query) return true
      return `${submission.playerName} ${submission.submitterLabel} ${submission.eventLabel} ${submission.detailLabel ?? ''}`.toLowerCase().includes(query)
    })
  }, [submissions, typeFilter, statusFilter, textFilter])

  return (
    <details open={defaultOpen} className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Submitted observations</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review submitted event and tactical-pattern observations before they become official records.
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Accepted event submissions become official match events. Accepted patterns become official pattern observations only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {submissions.length} total
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
              {pendingCount} pending
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
        <label className="text-sm font-bold text-slate-700">Type<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}><option value="all">All</option><option value="event">Events</option><option value="pattern">Tactical patterns</option></select></label>
        <label className="text-sm font-bold text-slate-700">Status<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="IGNORED">Ignored</option><option value="all">All</option></select></label>
        <label className="text-sm font-bold text-slate-700">Player, unit or contributor<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Search review rows" /></label>
      </div>

      {visibleSubmissions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          No submitted observations match these filters.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleSubmissions.map((submission) => (
            <article key={submission.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{submission.type === 'pattern' ? 'Tactical pattern' : 'Event'}</p>
                    <p className="font-bold text-slate-950">{submission.eventLabel}</p>
                    {submission.detailLabel && <p className="mt-1 text-sm font-semibold text-slate-700">{submission.detailLabel}</p>}
                    <p className="mt-1 text-sm text-slate-600">
                      {submission.playerName} / {formatSquadNumber(submission.squadNumber)}
                      {submission.hasLocation ? ' / location saved' : ''}
                    </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(submission.status)}`}>
                  {submission.statusLabel}
                </span>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-semibold text-slate-500">Submitted by</dt>
                  <dd className="mt-1 break-words text-slate-900">{submission.submitterLabel}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-semibold text-slate-500">Match time</dt>
                  <dd className="mt-1 text-slate-900">{submission.halfLabel} · {submission.matchTime}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-semibold text-slate-500">Created</dt>
                  <dd className="mt-1 text-slate-900">{submission.createdAtLabel}</dd>
                </div>
              </dl>

              {submission.note && (
                <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                  {submission.note}
                </p>
              )}

              {submission.status === 'PENDING' && canReview && (
                <ParentSubmissionReviewActions
                  matchDayId={matchDayId}
                  submittedMatchEventId={submission.type === 'event' ? submission.id : undefined}
                  submittedPatternObservationId={submission.type === 'pattern' ? submission.id : undefined}
                  observationType={submission.type}
                  matchStatus={matchStatus}
                  acceptParentSubmissionAction={acceptParentSubmissionAction}
                  ignoreParentSubmissionAction={ignoreParentSubmissionAction}
                  reviewPatternSubmissionAction={reviewPatternSubmissionAction}
                />
              )}

              {submission.status !== 'PENDING' && submission.reviewedAtLabel && (
                <p className="mt-3 text-sm text-slate-500">
                  Reviewed {submission.reviewedAtLabel}
                  {submission.reviewedByLabel ? ` by ${submission.reviewedByLabel}` : ''}.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </details>
  )
}
