import Link from 'next/link'

import type { DashboardData, DashboardParentSubmission } from '@/lib/dashboard'

type ParentDashboardData = Extract<DashboardData, { kind: 'parent' }>

type ParentDashboardPanelProps = {
  data: ParentDashboardData
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

export default function ParentDashboardPanel({ data }: ParentDashboardPanelProps) {
  return (
    <section className="mt-6 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-amber-700">Parent dashboard</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Your linked player activity</h2>
          <p className="mt-1 text-sm text-slate-600">
            View linked players and add observations when a linked player has a live match.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/my-player" className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900">
            View linked player
          </Link>
          <Link href="/my-player/matches" className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50">
            Match observations
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ParentStat label="Linked players" value={data.linkedPlayerCount} />
        <ParentStat label="Live matches available" value={data.liveMatchCount} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Recent submissions</h3>
        {data.recentSubmissions.length === 0 ? (
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No parent observations submitted yet.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {data.recentSubmissions.map((submission) => (
              <SubmissionItem key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ParentStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-amber-950">{value}</p>
    </div>
  )
}

function SubmissionItem({ submission }: { submission: DashboardParentSubmission }) {
  return (
    <Link href={submission.href} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-200 hover:bg-amber-50/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-950">{submission.title}</p>
          <p className="mt-1 text-sm text-slate-600">{submission.subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{submission.status}</span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">Submitted {formatDateTime(submission.createdAt)}</p>
    </Link>
  )
}
