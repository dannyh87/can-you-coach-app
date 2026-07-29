import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import {
  archiveTrackingTaskAction,
  acceptDirectAssignmentAction,
  cancelAssignmentAction,
  claimGroupOfferAction,
  copyTrackingTaskAction,
  createAssignmentLinkedSubmissionAction,
  createDirectAssignmentAction,
  createGroupOfferAction,
  createSelfAssignmentAction,
  createTrackingTaskAction,
  declineDirectAssignmentAction,
  declineGroupOfferAction,
  markAssignmentSubmittedAction,
  markTrackingTaskReadyAction,
  setTrackingTaskEventsAction,
  startAssignmentAction,
  type MatchTrackingActionResult,
} from '@/lib/matchTrackingActions'
import { getEventDisplayName } from '@/lib/eventDefinitions'
import { getEligibleContributorsForTask, getMatchTrackingHarnessData, getMatchTrackingHarnessMatches, getPreviousTrackingTasksForCopy } from '@/lib/matchTrackingQueries'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'

export const dynamic = 'force-dynamic'

type SearchParams = {
  matchDayId?: string
  taskId?: string
  result?: string
  error?: string
}

const harnessEnabled = () => process.env.ENABLE_MATCH_TRACKING_DEV_HARNESS === 'true'

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)

const getActionRedirect = (formData: FormData, result: MatchTrackingActionResult<unknown>) => {
  const matchDayId = typeof formData.get('matchDayId') === 'string'
    ? String(formData.get('matchDayId'))
    : typeof formData.get('destinationMatchDayId') === 'string'
      ? String(formData.get('destinationMatchDayId'))
      : ''
  const taskId = typeof formData.get('trackingTaskId') === 'string' ? String(formData.get('trackingTaskId')) : ''
  const params = new URLSearchParams()
  if (matchDayId) params.set('matchDayId', matchDayId)
  if (taskId) params.set('taskId', taskId)
  if (result.ok) params.set('result', 'Action completed.')
  else params.set('error', `${result.code}: ${result.message}`)
  return `/dev/match-tracking?${params.toString()}`
}

async function runHarnessAction(formData: FormData, action: (formData: FormData) => Promise<MatchTrackingActionResult<unknown>>) {
  'use server'
  const result = await action(formData)
  redirect(getActionRedirect(formData, result))
}

const createTask = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, createTrackingTaskAction)
}

const setEvents = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, setTrackingTaskEventsAction)
}

const markReady = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, markTrackingTaskReadyAction)
}

const archiveTask = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, archiveTrackingTaskAction)
}

const copyTask = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, copyTrackingTaskAction)
}

const selfAssign = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, createSelfAssignmentAction)
}

const directAssign = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, createDirectAssignmentAction)
}

const groupOffer = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, createGroupOfferAction)
}

const startAssignment = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, startAssignmentAction)
}

const submitAssignment = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, markAssignmentSubmittedAction)
}

const cancelAssignment = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, cancelAssignmentAction)
}

const acceptDirect = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, acceptDirectAssignmentAction)
}

const declineDirect = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, declineDirectAssignmentAction)
}

const claimOffer = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, claimGroupOfferAction)
}

const declineOffer = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, declineGroupOfferAction)
}

const createLinkedSubmission = async (formData: FormData) => {
  'use server'
  await runHarnessAction(formData, createAssignmentLinkedSubmissionAction)
}

export default async function MatchTrackingHarnessPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!harnessEnabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()

  const params = await searchParams
  const matches = await getMatchTrackingHarnessMatches(user.id)
  const selectedMatchId = params.matchDayId ?? matches[0]?.id ?? null
  const match = selectedMatchId ? await getMatchTrackingHarnessData(user.id, selectedMatchId) : null
  const selectedTask = match?.matchTrackingTasks.find((task) => task.id === params.taskId) ?? match?.matchTrackingTasks[0] ?? null
  const eligibleContributors = selectedTask ? await getEligibleContributorsForTask(selectedTask.id) : []
  const previousTasks = selectedMatchId ? await getPreviousTrackingTasksForCopy(user.id, selectedMatchId) : []

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:p-6">
      <PageHeader title="Match Tracking Dev Harness" description="Development-only verification for Match Day V2 tracking tasks and assignments." />
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
        ENABLE_MATCH_TRACKING_DEV_HARNESS is enabled. Do not expose this route publicly.
      </section>
      {params.result && <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{params.result}</p>}
      {params.error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{params.error}</p>}

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold">Select match</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {matches.map((candidate) => (
            <Link key={candidate.id} href={`/dev/match-tracking?matchDayId=${candidate.id}`} className={`rounded-xl border p-3 text-sm ${candidate.id === selectedMatchId ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
              <p className="font-bold">{candidate.team.name} vs {candidate.opposition}</p>
              <p className="mt-1 text-slate-600">{formatDate(candidate.kickoffAt)} · {candidate.status}</p>
              <p className="mt-1 text-xs text-slate-500">{candidate.id}</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">Squad {candidate.matchDayPlayers.length} · Events {candidate.matchDayEventTypes.length} · Tasks {candidate.matchTrackingTasks.length}</p>
            </Link>
          ))}
        </div>
      </section>

      {match && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-bold">Create task</h2>
            <form action={createTask} className="mt-3 grid gap-3 text-sm">
              <input type="hidden" name="matchDayId" value={match.id} />
              <label className="font-semibold">Scope
                <select name="scopeType" className="mt-1 w-full rounded border p-2">
                  <option value="PLAYER">Player</option>
                  <option value="UNIT">Unit</option>
                  <option value="TEAM">Team</option>
                </select>
              </label>
              <label className="font-semibold">Player
                <select name="playerId" className="mt-1 w-full rounded border p-2">
                  <option value="">No player</option>
                  {match.matchDayPlayers.map((matchPlayer) => <option key={matchPlayer.playerId} value={matchPlayer.playerId}>{matchPlayer.player.firstName} {matchPlayer.player.surname}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-semibold">Unit key<input name="unitKey" className="mt-1 w-full rounded border p-2" placeholder="defensive-unit" /></label>
                <label className="font-semibold">Unit label<input name="unitLabel" className="mt-1 w-full rounded border p-2" placeholder="Defensive unit" /></label>
              </div>
              <label className="font-semibold">Title<input name="title" required className="mt-1 w-full rounded border p-2" /></label>
              <label className="font-semibold">Instructions<textarea name="instructions" className="mt-1 w-full rounded border p-2" rows={3} /></label>
              <button className="rounded bg-blue-700 px-4 py-2 font-bold text-white">Create task</button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-bold">Selected match events</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {match.matchDayEventTypes.map((eventType) => (
                <div key={eventType.id} className="rounded-xl border p-3">
                  <p className="font-bold">{getEventDisplayName(eventType)}</p>
                  <p className="mt-1 text-xs text-slate-500">row {eventType.id}</p>
                  <p className="mt-1 text-xs text-slate-600">definition {eventType.eventDefinitionId ?? 'none'} · legacy {eventType.eventType ?? 'none'} · location {eventType.eventDefinition?.requiresLocation ? 'required' : 'not required'}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm xl:col-span-2">
            <h2 className="text-xl font-bold">Tasks</h2>
            <div className="mt-3 grid gap-4">
              {match.matchTrackingTasks.map((task) => (
                <article key={task.id} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{task.title}</h3>
                      <p className="text-sm text-slate-600">{task.scopeType} · {task.status} · {task.player ? `${task.player.firstName} ${task.player.surname}` : task.unitLabel ?? 'No target selected'}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.id}</p>
                    </div>
                    <Link href={`/dev/match-tracking?matchDayId=${match.id}&taskId=${task.id}`} className="text-sm font-bold text-blue-700 hover:underline">Inspect</Link>
                  </div>
                  <form action={setEvents} className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <input type="hidden" name="matchDayId" value={match.id} />
                    <input type="hidden" name="trackingTaskId" value={task.id} />
                    <p className="font-bold">Attach events</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {match.matchDayEventTypes.map((eventType) => <label key={eventType.id} className="flex gap-2"><input type="checkbox" name="matchDayEventTypeId" value={eventType.id} defaultChecked={task.events.some((event) => event.matchDayEventTypeId === eventType.id)} /> {getEventDisplayName(eventType)}</label>)}
                    </div>
                    <button className="mt-3 rounded bg-slate-900 px-3 py-2 font-bold text-white">Save task events</button>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={markReady}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="trackingTaskId" value={task.id} /><button className="rounded bg-green-700 px-3 py-2 text-sm font-bold text-white">Mark ready</button></form>
                    <form action={archiveTask}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="trackingTaskId" value={task.id} /><button className="rounded bg-slate-700 px-3 py-2 text-sm font-bold text-white">Archive</button></form>
                    <form action={selfAssign}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="trackingTaskId" value={task.id} /><button className="rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white">Self assign</button></form>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {selectedTask && (
            <section className="rounded-2xl border bg-white p-4 shadow-sm xl:col-span-2">
              <h2 className="text-xl font-bold">Selected task lifecycle</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedTask.title} · {selectedTask.id}</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <h3 className="font-bold">Eligible contributors</h3>
                  <div className="mt-2 space-y-2 text-sm">
                    {eligibleContributors.map((contributor) => <p key={contributor.userId} className="rounded bg-slate-50 p-2">{contributor.userId} · {contributor.kind} · {contributor.roles.join(', ') || 'spectator'} · players {contributor.playerIds.join(', ') || 'n/a'}</p>)}
                  </div>
                  <form action={directAssign} className="mt-3 grid gap-2 text-sm">
                    <input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="trackingTaskId" value={selectedTask.id} />
                    <select name="assignedUserId" className="rounded border p-2">{eligibleContributors.map((c) => <option key={c.userId} value={c.userId}>{c.userId}</option>)}</select>
                    <button className="rounded bg-blue-700 px-3 py-2 font-bold text-white">Create direct assignment</button>
                  </form>
                  <form action={groupOffer} className="mt-3 text-sm">
                    <input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="trackingTaskId" value={selectedTask.id} />
                    <div className="grid gap-2">{eligibleContributors.map((c) => <label key={c.userId} className="flex gap-2"><input type="checkbox" name="recipientUserId" value={c.userId} /> {c.userId}</label>)}</div>
                    <button className="mt-2 rounded bg-indigo-700 px-3 py-2 font-bold text-white">Create group offer</button>
                  </form>
                </div>
                <div className="rounded-xl border p-3">
                  <h3 className="font-bold">Copy previous task</h3>
                  <form action={copyTask} className="mt-2 grid gap-2 text-sm">
                    <input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="destinationMatchDayId" value={match.id} />
                    <select name="sourceTaskId" className="rounded border p-2">{previousTasks.map((task) => <option key={task.id} value={task.id}>{task.title} ({formatDate(task.matchDay.kickoffAt)})</option>)}</select>
                    <select name="destinationPlayerId" className="rounded border p-2"><option value="">No destination player</option>{match.matchDayPlayers.map((p) => <option key={p.playerId} value={p.playerId}>{p.player.firstName} {p.player.surname}</option>)}</select>
                    <button className="rounded bg-slate-900 px-3 py-2 font-bold text-white">Copy task into this match</button>
                  </form>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {selectedTask.assignments.map((assignment) => (
                  <article key={assignment.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-bold">{assignment.assignmentMode} · {assignment.status}</p>
                    <p className="text-xs text-slate-500">assignment {assignment.id} · assigned {assignment.assignedUserId ?? 'none'}</p>
                    <p className="mt-1 text-xs text-slate-600">recipients {assignment.recipients.map((r) => r.userId).join(', ') || 'none'} · submissions {assignment.submittedMatchEvents.length}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={startAssignment}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-blue-700 px-2 py-1 font-bold text-white">Start as current user</button></form>
                      <form action={submitAssignment}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-green-700 px-2 py-1 font-bold text-white">Submit assignment</button></form>
                      <form action={cancelAssignment}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-red-700 px-2 py-1 font-bold text-white">Cancel</button></form>
                      <form action={acceptDirect}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-sky-700 px-2 py-1 font-bold text-white">Accept direct</button></form>
                      <form action={declineDirect}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-slate-700 px-2 py-1 font-bold text-white">Decline direct</button></form>
                      <form action={claimOffer}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-indigo-700 px-2 py-1 font-bold text-white">Claim offer</button></form>
                      <form action={declineOffer}><input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded bg-slate-700 px-2 py-1 font-bold text-white">Decline offer</button></form>
                    </div>
                    <form action={createLinkedSubmission} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-2">
                      <input type="hidden" name="matchDayId" value={match.id} /><input type="hidden" name="assignmentId" value={assignment.id} />
                      <select name="playerId" className="rounded border p-2">{match.matchDayPlayers.map((p) => <option key={p.playerId} value={p.playerId}>{p.player.firstName} {p.player.surname}</option>)}</select>
                      <select name="matchDayEventTypeId" className="rounded border p-2">{selectedTask.events.map((event) => <option key={event.matchDayEventTypeId} value={event.matchDayEventTypeId}>{getEventDisplayName(event.matchDayEventType)}</option>)}</select>
                      <div className="grid gap-2 sm:grid-cols-2"><input name="x" placeholder="x optional" className="rounded border p-2" /><input name="y" placeholder="y optional" className="rounded border p-2" /></div>
                      <input name="note" placeholder="optional note" className="rounded border p-2" />
                      <button className="rounded bg-emerald-700 px-2 py-1 font-bold text-white">Create assignment-linked observation</button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}
