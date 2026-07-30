import { notFound } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { acceptDirectAssignmentForCurrentUserAction, claimGroupOfferForCurrentUserAction, declineDirectAssignmentForCurrentUserAction, declineGroupOfferForCurrentUserAction, startAssignmentForCurrentUserAction } from '@/lib/myAssignmentActions'
import { formatAssignmentStatus, getAssignmentPrimaryAction, getAssignmentForUser, getAssignmentTarget } from '@/lib/myAssignments'
import { getEventDisplayName } from '@/lib/eventDefinitions'

export const dynamic = 'force-dynamic'

const formatDateTime = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)

export default async function AssignmentDetailPage({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const [{ assignmentId }, query] = await Promise.all([params, searchParams])
  const assignment = await getAssignmentForUser(user.id, assignmentId)
  if (!assignment) notFound()

  const task = assignment.trackingTask
  const match = task.matchDay
  const primaryAction = getAssignmentPrimaryAction(assignment, user.id, match.status)
  const currentRecipient = assignment.recipients.find((recipient) => recipient.userId === user.id)
  const groupTakenByOther = assignment.assignmentMode === 'GROUP_OFFER' && assignment.status === 'ACCEPTED' && assignment.assignedUserId !== user.id

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader title="Assignment details" description="Review what you are being asked to track." />
      {query.success && <p className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{query.success}</p>}
      {query.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{query.error}</p>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">{match.team.club.name} / {match.team.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-950">{task.title}</h1>
            <p className="mt-1 text-sm text-slate-600">Vs {match.opposition} · {formatDateTime(match.kickoffAt)}</p>
          </div>
          <StatusBadge label={formatAssignmentStatus(assignment.status)} variant={getStatusBadgeVariant(assignment.status)} />
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <Info label="Type" value={task.scopeType} />
          <Info label="Target" value={getAssignmentTarget(task)} />
          <Info label="Events" value={`${task.events.length}`} />
        </dl>

        {task.instructions && <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">{task.instructions}</p>}

        <section className="mt-5">
          <h2 className="text-lg font-bold text-slate-950">Events to record</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {task.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-bold text-slate-950">{getEventDisplayName(event.matchDayEventType)}</p>
                <p className="mt-1 text-slate-600">{event.matchDayEventType.eventDefinition?.requiresLocation ? 'Requires pitch location' : 'No pitch location required'}</p>
              </div>
            ))}
          </div>
        </section>

        {groupTakenByOther && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">This tracking task has already been accepted by another contributor.</p>}
        {currentRecipient?.closedAt && !groupTakenByOther && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">This offer is no longer available.</p>}
        {assignment.status === 'SUBMITTED' && <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">Submitted to coaching team. This is not approved until coaches review observations.</p>}
        {assignment.status === 'IN_PROGRESS' && <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">The final live recording interface is coming in the next phase.</p>}

        <AssignmentActions assignmentId={assignment.id} primaryAction={primaryAction} />
      </section>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  )
}

function AssignmentActions({ assignmentId, primaryAction }: { assignmentId: string; primaryAction: string }) {
  if (primaryAction === 'respond-direct') {
    return (
      <div className="mt-5 flex flex-wrap gap-2">
        <form action={acceptDirectAssignmentForCurrentUserAction}><input type="hidden" name="assignmentId" value={assignmentId} /><button className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">Accept</button></form>
        <form action={declineDirectAssignmentForCurrentUserAction}><input type="hidden" name="assignmentId" value={assignmentId} /><button className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Decline</button></form>
      </div>
    )
  }
  if (primaryAction === 'respond-group') {
    return (
      <div className="mt-5 flex flex-wrap gap-2">
        <form action={claimGroupOfferForCurrentUserAction}><input type="hidden" name="assignmentId" value={assignmentId} /><button className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">Accept this task</button></form>
        <form action={declineGroupOfferForCurrentUserAction}><input type="hidden" name="assignmentId" value={assignmentId} /><button className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Not available</button></form>
      </div>
    )
  }
  if (primaryAction === 'start') {
    return <form action={startAssignmentForCurrentUserAction} className="mt-5"><input type="hidden" name="assignmentId" value={assignmentId} /><button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Start tracking</button></form>
  }
  return null
}
