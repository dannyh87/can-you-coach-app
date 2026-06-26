type ParentSubmissionRow = {
  id: string
  playerName: string
  squadNumber: number | null
  eventLabel: string
  submitterLabel: string
  halfLabel: string
  matchTime: string
  statusLabel: string
  status: 'PENDING' | 'ACCEPTED' | 'IGNORED'
  createdAtLabel: string
  note: string | null
}

type ParentSubmissionsPanelProps = {
  submissions: ParentSubmissionRow[]
  pendingCount: number
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
  submissions,
  pendingCount,
  defaultOpen = false,
}: ParentSubmissionsPanelProps) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Parent submissions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Read-only parent observations. Not included in official report or CSV yet.
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

      {submissions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          No parent submissions yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{submission.eventLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {submission.playerName} / {formatSquadNumber(submission.squadNumber)}
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
            </article>
          ))}
        </div>
      )}
    </details>
  )
}
