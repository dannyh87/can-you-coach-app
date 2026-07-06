import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { formatMatchEventType } from '@/lib/matchEventTaxonomy'
import {
  getParentLinkedPlayersForMatch,
  getSecondsBetween,
  validateParentSubmission,
} from '@/lib/parentMatchAccess'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)

const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

const formatHalf = (half: string) => half === 'FIRST_HALF' ? 'First half' : 'Second half'

const formatMatchTime = (matchSecond: number) => {
  const minutes = Math.floor(matchSecond / 60)
  const seconds = matchSecond % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getStatusClasses = (status: string) => {
  if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800'
  if (status === 'HALF_TIME') return 'bg-amber-100 text-amber-900'
  if (status === 'COMPLETED') return 'bg-green-100 text-green-800'
  return 'bg-slate-100 text-slate-700'
}

const getSubmissionStatusClasses = (status: string) => {
  if (status === 'ACCEPTED') return 'bg-green-100 text-green-800'
  if (status === 'IGNORED') return 'bg-slate-100 text-slate-700'
  return 'bg-amber-100 text-amber-900'
}

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function submitParentMatchEvent(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const matchDayId = getTextValue(formData, 'matchDayId')
  const playerId = getTextValue(formData, 'playerId')
  const eventType = getTextValue(formData, 'eventType')
  const note = getTextValue(formData, 'note').slice(0, 280)

  const targetPath = `/my-player/matches/${matchDayId}${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ''}`
  const validation = await validateParentSubmission({ userId: user.id, matchDayId, playerId, eventType })
  if (!validation.ok) {
    redirect(`${targetPath}&error=${encodeURIComponent(validation.reason)}`)
  }

  const duplicateSince = new Date(Date.now() - 5000)
  const duplicate = await prisma.submittedMatchEvent.findFirst({
    where: {
      matchDayId,
      playerId,
      submittedByUserId: user.id,
      eventType: validation.eventType,
      createdAt: { gte: duplicateSince },
    },
    select: { id: true },
  })
  if (duplicate) {
    redirect(`${targetPath}&error=${encodeURIComponent('That observation was already submitted a moment ago.')}`)
  }

  const now = new Date()
  await prisma.submittedMatchEvent.create({
    data: {
      matchDayId,
      playerId,
      submittedByUserId: user.id,
      eventType: validation.eventType,
      half: validation.activeHalf.half,
      matchSecond: getSecondsBetween(validation.activeHalf.startedAt, now),
      ownScoreAtTime: validation.match.ownScore,
      oppositionScoreAtTime: validation.match.oppositionScore,
      note: note || null,
      status: 'PENDING',
    },
  })

  revalidatePath(`/my-player/matches/${matchDayId}`)
  redirect(`${targetPath}&success=${encodeURIComponent('Observation submitted.')}`)
}

async function undoParentMatchEvent(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const submittedEventId = getTextValue(formData, 'submittedEventId')

  const submittedEvent = await prisma.submittedMatchEvent.findFirst({
    where: {
      id: submittedEventId,
      submittedByUserId: user.id,
      status: 'PENDING',
    },
    select: { id: true, matchDayId: true, playerId: true },
  })

  if (!submittedEvent) return

  await prisma.submittedMatchEvent.delete({ where: { id: submittedEvent.id } })
  revalidatePath(`/my-player/matches/${submittedEvent.matchDayId}`)
  redirect(`/my-player/matches/${submittedEvent.matchDayId}?playerId=${encodeURIComponent(submittedEvent.playerId)}&success=${encodeURIComponent('Pending observation removed.')}`)
}

export default async function ParentMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchDayId: string }>
  searchParams: Promise<{ playerId?: string; error?: string; success?: string }>
}) {
  const user = await getCurrentUser()
  const { matchDayId } = await params
  const query = await searchParams
  const linkedPlayers = await getParentLinkedPlayersForMatch(user.id, matchDayId)

  if (linkedPlayers.length === 0) notFound()

  const selectedPlayer = linkedPlayers.find((player) => player.playerId === query.playerId) ?? linkedPlayers[0]
  const match = await prisma.matchDay.findFirst({
    where: {
      id: matchDayId,
      status: { not: 'DRAFT' },
    },
    include: {
      team: { include: { club: true } },
      matchDayEventTypes: { orderBy: { createdAt: 'asc' } },
      submittedMatchEvents: {
        where: { submittedByUserId: user.id },
        include: { player: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!match) notFound()

  const canSubmit = match.status === 'IN_PROGRESS' && selectedPlayer.isOnPitch
  const parentRecordableEventTypes = match.matchDayEventTypes.flatMap((eventType) => {
    if (!eventType.eventType) return []
    return [{ ...eventType, eventType: eventType.eventType }]
  })
  const readOnlyMessage = match.status === 'HALF_TIME'
    ? 'The match is at half-time. Parent observations are paused until play resumes.'
    : match.status === 'COMPLETED'
      ? 'This match is completed. You can view your submitted-event history.'
      : !selectedPlayer.isOnPitch
        ? 'This player is not currently recorded as on pitch.'
        : null

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Parent Match Observations"
        description="Submit observations for your linked player only. These do not change the official coach match record."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {match.team.club.name} / {match.team.name}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Vs {match.opposition}</h1>
            <p className="mt-1 text-sm text-slate-600">{formatDateTime(match.kickoffAt)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(match.status)}`}>
            {formatStatus(match.status)}
          </span>
        </div>
      </section>

      {(query.error || query.success) && (
        <p className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${query.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {query.error ?? query.success}
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Linked player</h2>
        {linkedPlayers.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {linkedPlayers.map((player) => (
              <Link
                key={player.playerId}
                href={`/my-player/matches/${match.id}?playerId=${player.playerId}`}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${player.playerId === selectedPlayer.playerId ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-300'}`}
              >
                {player.squadNumber ? `${player.squadNumber}. ` : ''}{player.firstName} {player.surname}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
            {selectedPlayer.squadNumber ? `${selectedPlayer.squadNumber}. ` : ''}{selectedPlayer.firstName} {selectedPlayer.surname}
          </p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-950">Submit observation</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedPlayer.isOnPitch ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
            {selectedPlayer.isOnPitch ? 'On pitch' : 'Not on pitch'}
          </span>
        </div>

        {readOnlyMessage && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            {readOnlyMessage}
          </p>
        )}

        {parentRecordableEventTypes.length === 0 ? (
          <EmptyState
            title="No event buttons selected"
            description="The coach has not selected any recordable event types for this match."
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {parentRecordableEventTypes.map((eventType) => (
              <form key={eventType.id} action={submitParentMatchEvent} className="rounded-xl border border-slate-200 p-3">
                <input type="hidden" name="matchDayId" value={match.id} />
                <input type="hidden" name="playerId" value={selectedPlayer.playerId} />
                <input type="hidden" name="eventType" value={eventType.eventType} />
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`note-${eventType.id}`}>
                  Optional note
                </label>
                <textarea
                  id={`note-${eventType.id}`}
                  name="note"
                  rows={2}
                  maxLength={280}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Add context for the coach"
                  disabled={!canSubmit}
                />
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {formatMatchEventType(eventType.eventType)}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Your recent submissions</h2>
        {match.submittedMatchEvents.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            You have not submitted any observations for this match yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {match.submittedMatchEvents.map((submittedEvent) => (
              <div key={submittedEvent.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{formatMatchEventType(submittedEvent.eventType)}</p>
                    <p className="text-sm text-slate-600">
                      {submittedEvent.player.firstName} {submittedEvent.player.surname} / {formatHalf(submittedEvent.half)} {formatMatchTime(submittedEvent.matchSecond)}
                    </p>
                    {submittedEvent.note && <p className="mt-2 text-sm text-slate-700">{submittedEvent.note}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${getSubmissionStatusClasses(submittedEvent.status)}`}>
                    {formatStatus(submittedEvent.status)}
                  </span>
                </div>
                {submittedEvent.status === 'PENDING' && (
                  <form action={undoParentMatchEvent} className="mt-3">
                    <input type="hidden" name="submittedEventId" value={submittedEvent.id} />
                    <button type="submit" className="text-sm font-bold text-red-700 hover:underline">
                      Undo pending submission
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/my-player/matches" className="mt-6 inline-flex text-sm font-semibold text-blue-800 hover:underline">
        Back to Match Observations
      </Link>
    </main>
  )
}
