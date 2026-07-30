import Link from 'next/link'
import { notFound } from 'next/navigation'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { formatAssignmentStatus, getAssignmentPrimaryAction, getAssignmentsForUser, getAssignmentTarget } from '@/lib/myAssignments'

export const dynamic = 'force-dynamic'

const formatDateTime = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)

export default async function MyAssignmentsPage() {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const assignments = await getAssignmentsForUser(user.id)
  const groups = [
    { title: 'Needs response', items: assignments.filter((assignment) => getAssignmentPrimaryAction(assignment, user.id, assignment.trackingTask.matchDay.status).startsWith('respond')) },
    { title: 'Upcoming', items: assignments.filter((assignment) => assignment.status === 'ACCEPTED') },
    { title: 'In progress', items: assignments.filter((assignment) => assignment.status === 'IN_PROGRESS') },
    { title: 'Submitted', items: assignments.filter((assignment) => assignment.status === 'SUBMITTED') },
    { title: 'Past', items: assignments.filter((assignment) => ['DECLINED', 'CANCELLED'].includes(assignment.status) || (assignment.assignmentMode === 'GROUP_OFFER' && assignment.status === 'ACCEPTED' && assignment.assignedUserId !== user.id)) },
  ]

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <PageHeader title="My Match Day assignments" description="Tracking tasks assigned or offered to you appear here." />
      {assignments.length === 0 ? (
        <EmptyState title="No Match Day assignments" description="Tasks assigned or offered to you will appear here." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => <AssignmentGroup key={group.title} title={group.title} assignments={group.items} userId={user.id} />)}
        </div>
      )}
    </main>
  )
}

function AssignmentGroup({ title, assignments, userId }: { title: string; assignments: Awaited<ReturnType<typeof getAssignmentsForUser>>; userId: string }) {
  if (assignments.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {assignments.map((assignment) => {
          const task = assignment.trackingTask
          const match = task.matchDay
          const primaryAction = getAssignmentPrimaryAction(assignment, userId, match.status)
          return (
            <Link key={assignment.id} href={`/my-assignments/${assignment.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{match.team.club.name} / {match.team.name}</p>
                  <h3 className="mt-1 break-words text-xl font-extrabold text-slate-950">{task.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">Vs {match.opposition} · {formatDateTime(match.kickoffAt)}</p>
                </div>
                <StatusBadge label={formatAssignmentStatus(assignment.status)} variant={getStatusBadgeVariant(assignment.status)} />
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Type</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{task.scopeType}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-bold text-slate-500">Target</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{getAssignmentTarget(task)}</dd>
                </div>
              </dl>
              {task.instructions && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{task.instructions}</p>}
              <p className="mt-3 text-sm font-bold text-emerald-800">{getActionLabel(primaryAction)}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function getActionLabel(action: string) {
  if (action === 'respond-direct') return 'Accept or decline'
  if (action === 'respond-group') return 'Accept this task or decline'
  if (action === 'start') return 'Start tracking'
  if (action === 'continue') return 'Continue tracking'
  return 'View assignment'
}
