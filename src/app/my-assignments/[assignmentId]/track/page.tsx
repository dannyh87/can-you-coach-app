import Link from 'next/link'
import { notFound } from 'next/navigation'

import AssignmentTrackingClient from '@/app/my-assignments/[assignmentId]/track/AssignmentTrackingClient'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { getCurrentUser } from '@/lib/auth'
import { getEventDisplayName } from '@/lib/eventDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { finishAssignmentTrackingAction, recordAssignmentObservationAction, startAssignmentForCurrentUserAction, undoAssignmentObservationAction } from '@/lib/myAssignmentActions'
import { formatAssignmentStatus, getAssignmentForUser, getAssignmentTarget, getTrackableAssignmentForUser } from '@/lib/myAssignments'

export const dynamic = 'force-dynamic'

const formatDateTime = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
const formatStatus = (status: string) => status.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ')
const formatHalf = (half: string) => half === 'FIRST_HALF' ? 'First half' : 'Second half'
const formatMatchTime = (matchSecond: number) => `${String(Math.floor(matchSecond / 60)).padStart(2, '0')}:${String(matchSecond % 60).padStart(2, '0')}`

export default async function AssignmentTrackingPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const { assignmentId } = await params
  const visibleAssignment = await getAssignmentForUser(user.id, assignmentId)
  if (!visibleAssignment) notFound()

  const visibleTask = visibleAssignment.trackingTask
  const nonRecordableMessage = getNonRecordableMessage(visibleAssignment, user.id)
  const assignment = nonRecordableMessage ? null : await getTrackableAssignmentForUser(user.id, assignmentId)
  const task = assignment?.trackingTask ?? visibleTask
  const match = task.matchDay
  const targetLabel = getAssignmentTarget(task)
  const matchRecordable = match.status === 'IN_PROGRESS'
  const playerBlockedMessage = assignment?.trackingTask.scopeType === 'PLAYER'
    ? assignment.playerInSquad === false
      ? 'The assigned player is not in the match squad.'
      : assignment.playerOnPitch === false
        ? 'The assigned player is not currently on the pitch.'
        : null
    : null
  const blockedMessage = nonRecordableMessage
    ?? (assignment?.status === 'ACCEPTED' ? 'Start the assignment before recording observations.' : null)
    ?? (!matchRecordable ? getMatchBlockedMessage(match.status) : null)
    ?? playerBlockedMessage
  const canRecord = Boolean(assignment && assignment.status === 'IN_PROGRESS' && matchRecordable && !playerBlockedMessage)
  const canFinish = Boolean(assignment && assignment.status === 'IN_PROGRESS')
  const events = task.events.map((event) => ({
    id: event.matchDayEventTypeId,
    label: getEventDisplayName(event.matchDayEventType),
    description: event.matchDayEventType.eventDefinition?.description ?? null,
    requiresLocation: event.matchDayEventType.eventDefinition?.requiresLocation ?? false,
  }))
  const observations = (assignment?.submittedMatchEvents ?? []).map((observation) => ({
    id: observation.id,
    label: getEventDisplayName(observation),
    targetLabel: observation.player ? `${observation.player.firstName} ${observation.player.surname}` : targetLabel,
    matchTime: `${formatHalf(observation.half)} ${formatMatchTime(observation.matchSecond)}`,
    status: observation.status,
    statusLabel: formatStatus(observation.status),
    note: observation.note,
  }))

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader title="Live assignment tracking" description="Record only the observations requested in this assignment." />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href={`/my-assignments/${assignmentId}`} className="font-semibold text-emerald-700 hover:underline">Assignment details</Link>
        <Link href="/my-assignments" className="font-semibold text-emerald-700 hover:underline">All assignments</Link>
      </div>

      <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">{match.team.club.name} / {match.team.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-950">{task.title}</h1>
            <p className="mt-1 text-sm text-slate-600">Vs {match.opposition} · {formatDateTime(match.kickoffAt)}</p>
          </div>
          <StatusBadge label={formatAssignmentStatus(visibleAssignment.status)} variant={getStatusBadgeVariant(visibleAssignment.status)} />
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <Info label="Target" value={targetLabel} />
          <Info label="Match" value={formatStatus(match.status)} />
          <Info label="Pending observations" value={`${assignment?.pendingObservationCount ?? visibleAssignment.submittedMatchEvents.filter((event) => event.status === 'PENDING').length}`} />
        </dl>
        {task.instructions && <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">{task.instructions}</p>}
        {visibleAssignment.status === 'ACCEPTED' && !nonRecordableMessage && (
          <form action={startAssignmentForCurrentUserAction} className="mt-4">
            <input type="hidden" name="assignmentId" value={visibleAssignment.id} />
            <button className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-base font-extrabold text-white hover:bg-blue-800 sm:w-auto">Start tracking</button>
          </form>
        )}
      </section>

      <div className="space-y-4">
        <AssignmentTrackingClient
          assignmentId={visibleAssignment.id}
          matchDayId={match.id}
          playerId={task.scopeType === 'PLAYER' ? task.playerId : null}
          canRecord={canRecord}
          canFinish={canFinish}
          blockedMessage={blockedMessage}
          events={events}
          observations={observations}
          recordAssignmentObservationAction={recordAssignmentObservationAction}
          undoAssignmentObservationAction={undoAssignmentObservationAction}
          finishAssignmentTrackingAction={finishAssignmentTrackingAction}
        />
      </div>
    </main>
  )
}

function getNonRecordableMessage(assignment: NonNullable<Awaited<ReturnType<typeof getAssignmentForUser>>>, userId: string) {
  if (assignment.assignedUserId !== userId) return 'This tracking task is no longer assigned to your account.'
  if (assignment.trackingTask.status !== 'READY') return 'This tracking task is not ready for recording.'
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) return 'This assignment is not open for live recording.'
  return null
}

function getMatchBlockedMessage(status: string) {
  if (status === 'DRAFT') return 'The match has not started yet.'
  if (status === 'HALF_TIME') return 'The match is at half-time. Recording is paused until play resumes.'
  if (status === 'COMPLETED') return 'This match is completed.'
  return 'The match is not currently recordable.'
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  )
}
