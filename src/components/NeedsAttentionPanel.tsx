import Link from 'next/link'

import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import type { DashboardData, DashboardParentSubmission, DashboardWorkItem } from '@/lib/dashboard'

type CoachDashboardData = Extract<DashboardData, { kind: 'coach' }>

type NeedsAttentionPanelProps = {
  data: CoachDashboardData
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

export default function NeedsAttentionPanel({ data }: NeedsAttentionPanelProps) {
  const hasAttention =
    data.attention.pendingParentSubmissions.length > 0 ||
    data.attention.activeMatches.length > 0 ||
    data.attention.activeFitnessSessions.length > 0

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.055)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-950">Needs attention</h2>
        <p className="mt-1 text-sm text-slate-600">Review parent observations and jump back into live work.</p>
      </div>

      {!hasAttention ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Nothing needs attention right now.
        </p>
      ) : (
        <div className="space-y-4">
          <AttentionGroup title="Parent submissions to review" emptyText="No pending parent submissions.">
            {data.attention.pendingParentSubmissions.map((submission) => (
              <ParentSubmissionItem key={submission.id} submission={submission} />
            ))}
          </AttentionGroup>

          <AttentionGroup title="Active matches" emptyText="No matches live or at half-time.">
            {data.attention.activeMatches.map((item) => (
              <WorkItem key={item.id} item={item} />
            ))}
          </AttentionGroup>

          <AttentionGroup title="Active fitness sessions" emptyText="No fitness sessions in progress.">
            {data.attention.activeFitnessSessions.map((item) => (
              <WorkItem key={item.id} item={item} />
            ))}
          </AttentionGroup>
        </div>
      )}
    </section>
  )
}

function AttentionGroup({
  title,
  emptyText,
  children,
}: {
  title: string
  emptyText: string
  children: React.ReactNode
}) {
  const childArray = Array.isArray(children) ? children : [children]
  const hasChildren = childArray.some(Boolean)

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 space-y-2">
        {hasChildren ? children : <p className="text-sm text-slate-500">{emptyText}</p>}
      </div>
    </div>
  )
}

function ParentSubmissionItem({ submission }: { submission: DashboardParentSubmission }) {
  return (
    <Link href={submission.href} className="block rounded-xl border border-amber-100 bg-amber-50 p-3 transition hover:border-amber-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-amber-950">{submission.title}</p>
          <p className="mt-1 text-sm text-amber-900">{submission.subtitle}</p>
        </div>
        <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">{submission.status}</span>
      </div>
      <p className="mt-2 text-xs font-semibold text-amber-800">Submitted {formatDateTime(submission.createdAt)}</p>
    </Link>
  )
}

function WorkItem({ item }: { item: DashboardWorkItem }) {
  return (
    <Link href={item.href} className="block rounded-2xl border border-slate-200 bg-stone-50/80 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/70">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-950">{item.title}</p>
          <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
        </div>
        <StatusBadge label={item.status} variant={getStatusBadgeVariant(item.status)} />
      </div>
      <p className="mt-2 text-sm font-medium text-slate-600">{item.meta}</p>
    </Link>
  )
}
