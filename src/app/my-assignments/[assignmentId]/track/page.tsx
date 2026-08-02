import Link from 'next/link'
import { notFound } from 'next/navigation'

import AssignmentTrackingClient from '@/app/my-assignments/[assignmentId]/track/AssignmentTrackingClient'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { getCurrentUser } from '@/lib/auth'
import { getClubTrackingIdentityLabel } from '@/lib/clubTrackingDefinitions'
import { getEventDisplayName } from '@/lib/eventDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { finishAssignmentTrackingAction, recordAssignedClubEventAction, recordAssignedClubPatternAction, recordAssignmentObservationAction, recordAssignmentPatternObservationAction, startAssignmentForCurrentUserAction, undoAssignmentObservationAction } from '@/lib/myAssignmentActions'
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
  const clubEventLinks = task.clubDefinitions.filter((link) => ['EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM'].includes(link.selectedKind))
  const clubPatternLinks = task.clubDefinitions.filter((link) => ['PATTERN_ALIAS', 'PATTERN_MAPPED'].includes(link.selectedKind))
  const clubStandardEventIds = new Set(clubEventLinks.flatMap((link) => link.standardEventDefinitionIdAtSelection ? [link.standardEventDefinitionIdAtSelection] : []))
  const clubStandardPatternIds = new Set(clubPatternLinks.flatMap((link) => link.standardPatternDefinitionIdAtSelection ? [link.standardPatternDefinitionIdAtSelection] : []))
  const clubEvents = clubEventLinks.map((link) => {
    const definition = link.clubTrackingDefinition
    const standardName = link.standardEventDefinitionAtSelection?.name ?? definition.mappedEventDefinition?.name ?? null
    const mappedRequiresLocation = definition.mappedEventDefinition?.requiresLocation ?? false
    return {
      source: 'CLUB_EVENT' as const,
      id: link.id,
      taskClubDefinitionId: link.id,
      clubTrackingDefinitionId: definition.id,
      kind: link.selectedKind as 'EVENT_ALIAS' | 'EVENT_MAPPED' | 'EVENT_CUSTOM',
      label: definition.name,
      description: definition.guidance ?? definition.description ?? null,
      standardDisplayName: standardName,
      identityLabel: getClubTrackingIdentityLabel({ kind: definition.kind, mappingStatus: definition.mappingStatus }),
      requiresLocation: definition.kind === 'EVENT_CUSTOM' ? definition.requiresLocation : Boolean(definition.requiresLocation || mappedRequiresLocation),
    }
  })
  const standardEvents = task.events.filter((event) => !event.matchDayEventType.eventDefinitionId || !clubStandardEventIds.has(event.matchDayEventType.eventDefinitionId)).map((event) => ({
    source: 'STANDARD_EVENT' as const,
    id: event.matchDayEventTypeId,
    matchDayEventTypeId: event.matchDayEventTypeId,
    label: getEventDisplayName(event.matchDayEventType),
    description: event.matchDayEventType.eventDefinition?.description ?? null,
    standardDisplayName: null,
    identityLabel: null,
    requiresLocation: event.matchDayEventType.eventDefinition?.requiresLocation ?? false,
  }))
  const events = [...clubEvents, ...standardEvents]
  const clubPatterns = clubPatternLinks.map((link) => {
    const definition = link.clubTrackingDefinition
    const pattern = link.standardPatternDefinitionAtSelection ?? definition.mappedPatternDefinition
    return {
      source: 'CLUB_PATTERN' as const,
      id: link.id,
      taskClubDefinitionId: link.id,
      clubTrackingDefinitionId: definition.id,
      kind: link.selectedKind as 'PATTERN_ALIAS' | 'PATTERN_MAPPED',
      name: definition.name,
      description: definition.guidance ?? definition.description ?? null,
      standardDisplayName: pattern?.name ?? null,
      identityLabel: getClubTrackingIdentityLabel({ kind: definition.kind, mappingStatus: definition.mappingStatus }),
      requiresLocation: Boolean(definition.requiresLocation || pattern?.requiresLocation),
      steps: pattern?.steps.map((step) => ({ order: step.stepOrder, label: step.label ?? step.eventDefinition.name })) ?? [],
      outcomes: pattern?.outcomes.map((outcome) => ({ id: outcome.id, label: outcome.label, positive: outcome.positive })) ?? [],
      pendingCount: assignment?.submittedPatterns.filter((observation) => observation.clubTrackingDefinitionId === definition.id && observation.status === 'PENDING').length ?? visibleAssignment.submittedPatterns.filter((observation) => observation.status === 'PENDING').length,
    }
  })
  const standardPatterns = task.patterns.filter((taskPattern) => !clubStandardPatternIds.has(taskPattern.patternId)).map((taskPattern) => ({
    source: 'STANDARD_PATTERN' as const,
    id: taskPattern.patternId,
    patternId: taskPattern.patternId,
    name: taskPattern.pattern.name,
    description: taskPattern.pattern.description ?? null,
    standardDisplayName: null,
    identityLabel: null,
    requiresLocation: taskPattern.pattern.requiresLocation,
    steps: taskPattern.pattern.steps.map((step) => ({ order: step.stepOrder, label: step.label ?? step.eventDefinition.name })),
    outcomes: taskPattern.pattern.outcomes.map((outcome) => ({ id: outcome.id, label: outcome.label, positive: outcome.positive })),
    pendingCount: assignment?.submittedPatterns.filter((observation) => observation.patternId === taskPattern.patternId && observation.status === 'PENDING').length ?? visibleAssignment.submittedPatterns.filter((observation) => observation.status === 'PENDING').length,
  }))
  const patterns = [...clubPatterns, ...standardPatterns]
  const eventObservations = (assignment?.submittedMatchEvents ?? []).map((observation) => ({
    id: observation.id,
    type: 'event' as const,
    label: observation.clubTrackingDefinition?.name ?? getEventDisplayName(observation),
    detail: observation.clubTrackingDefinition ? getClubTrackingIdentityLabel({ kind: observation.clubTrackingDefinition.kind, mappingStatus: observation.clubMappingStatusAtRecording }) : null,
    targetLabel: observation.player ? `${observation.player.firstName} ${observation.player.surname}` : targetLabel,
    matchTime: `${formatHalf(observation.half)} ${formatMatchTime(observation.matchSecond)}`,
    createdAt: observation.createdAt.toISOString(),
    status: observation.status,
    statusLabel: formatStatus(observation.status),
    note: observation.note,
    hasLocation: observation.x !== null && observation.y !== null,
  }))
  const patternObservations = (assignment?.submittedPatterns ?? []).map((observation) => ({
    id: observation.id,
    type: 'pattern' as const,
    label: observation.clubTrackingDefinition?.name ?? observation.pattern.name,
    detail: `${observation.clubTrackingDefinition ? `${getClubTrackingIdentityLabel({ kind: observation.clubTrackingDefinition.kind, mappingStatus: observation.clubMappingStatusAtRecording })} · ` : ''}Outcome: ${observation.outcome.label}`,
    targetLabel: observation.player ? `${observation.player.firstName} ${observation.player.surname}` : targetLabel,
    matchTime: `${formatHalf(observation.half)} ${formatMatchTime(observation.matchSecond)}`,
    createdAt: observation.createdAt.toISOString(),
    status: observation.status,
    statusLabel: formatStatus(observation.status),
    note: observation.note,
    hasLocation: observation.x !== null && observation.y !== null,
  }))
  const observations = [...eventObservations, ...patternObservations].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 20)
  const eventCount = assignment?.submittedMatchEvents.length ?? visibleAssignment.submittedMatchEvents.length
  const patternCount = assignment?.submittedPatterns.length ?? visibleAssignment.submittedPatterns.length

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
          <Info label="Pending observations" value={`${assignment?.pendingObservationCount ?? visibleAssignment.submittedMatchEvents.filter((event) => event.status === 'PENDING').length + visibleAssignment.submittedPatterns.filter((pattern) => pattern.status === 'PENDING').length}`} />
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
          patterns={patterns}
          observations={observations}
          eventObservationCount={eventCount}
          patternObservationCount={patternCount}
          recordAssignmentObservationAction={recordAssignmentObservationAction}
          recordAssignmentPatternObservationAction={recordAssignmentPatternObservationAction}
          recordAssignedClubEventAction={recordAssignedClubEventAction}
          recordAssignedClubPatternAction={recordAssignedClubPatternAction}
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
