import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import FitnessTimerClient from '@/components/FitnessTimerClient'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import {
  endFitnessTestSession,
  startFitnessTestSession,
} from '@/lib/fitnessSessionActions'
import {
  formatFitnessSessionStatus,
  getFitnessSessionStatusClasses,
} from '@/lib/fitnessSessionStatus'
import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getOptionalFloatValue = (formData: FormData, key: string) => {
  const value = getTextValue(formData, key)
  if (!value) return null

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

const revalidateFitnessSessionPaths = (sessionId: string) => {
  revalidatePath('/fitness')
  revalidatePath(`/fitness/sessions/${sessionId}`)
  revalidatePath(`/fitness/sessions/${sessionId}/timer`)
  revalidatePath(`/fitness/sessions/${sessionId}/rankings`)
  revalidatePath('/fitness/progress')
}

async function getOwnedSession(sessionId: string) {
  const user = await getLocalUser()

  return prisma.fitnessTestSession.findFirst({
    where: {
      id: sessionId,
      team: {
        club: {
          userId: user.id,
        },
      },
    },
    include: {
      team: {
        include: {
          club: true,
        },
      },
      fitnessTestType: true,
    },
  })
}

async function saveTimedFinish(formData: FormData) {
  'use server'

  const sessionId = getTextValue(formData, 'fitnessTestSessionId')
  const playerId = getTextValue(formData, 'playerId')
  const resultValue = getOptionalFloatValue(formData, 'resultValue')
  const resultText = getTextValue(formData, 'resultText')

  if (!sessionId || !playerId || resultValue === null) return { ok: false }

  const session = await getOwnedSession(sessionId)
  if (!session) return { ok: false }
  if (session.status !== 'IN_PROGRESS') return { ok: false }
  if (!getFitnessRecordingModes(session.fitnessTestType).liveTimedFinish) {
    return { ok: false }
  }

  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      teamId: session.teamId,
      isActive: true,
    },
    select: { id: true },
  })

  if (!player) return { ok: false }

  await prisma.fitnessTestResult.upsert({
    where: {
      fitnessTestSessionId_playerId: {
        fitnessTestSessionId: session.id,
        playerId: player.id,
      },
    },
    update: {
      resultValue,
      resultText: resultText || null,
      status: 'COMPLETED',
    },
    create: {
      fitnessTestSessionId: session.id,
      playerId: player.id,
      resultValue,
      resultText: resultText || null,
      status: 'COMPLETED',
    },
  })

  revalidateFitnessSessionPaths(session.id)

  return {
    ok: true,
    playerId: player.id,
    resultValue,
    resultText: resultText || null,
  }
}

async function undoTimedFinish(formData: FormData) {
  'use server'

  const sessionId = getTextValue(formData, 'fitnessTestSessionId')
  const playerId = getTextValue(formData, 'playerId')

  if (!sessionId || !playerId) return { ok: false }
  const session = await getOwnedSession(sessionId)
  if (!session) return { ok: false }
  if (session.status !== 'IN_PROGRESS') return { ok: false }
  if (!getFitnessRecordingModes(session.fitnessTestType).liveTimedFinish) {
    return { ok: false }
  }

  await prisma.fitnessTestResult.deleteMany({
    where: {
      fitnessTestSessionId: session.id,
      playerId,
      player: {
        teamId: session.teamId,
        isActive: true,
      },
    },
  })

  revalidateFitnessSessionPaths(session.id)

  return { ok: true, playerId }
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatDateTime = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
    : 'Not started'

export default async function FitnessTimerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const { saved } = await searchParams
  const session = await getOwnedSession(id)

  if (!session) notFound()
  const recordingModes = getFitnessRecordingModes(session.fitnessTestType)
  if (!recordingModes.liveTimedFinish) notFound()

  const activePlayers = await prisma.player.findMany({
    where: {
      teamId: session.teamId,
      isActive: true,
    },
    orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
  })

  const existingResults = await prisma.fitnessTestResult.findMany({
    where: { fitnessTestSessionId: session.id },
  })
  const resultsByPlayerId = new Map(
    existingResults.map((result) => [result.playerId, result])
  )

  const players = activePlayers.map((player) => {
    const result = resultsByPlayerId.get(player.id)

    return {
      id: player.id,
      firstName: player.firstName,
      surname: player.surname,
      squadNumber: player.squadNumber,
      preferredPosition: player.preferredPosition,
      result: result
        ? {
            resultValue: result.resultValue,
            resultText: result.resultText,
          }
        : null,
    }
  })
  const savedMessage =
    saved === 'finish'
      ? 'Finish recorded.'
      : saved === 'undo'
        ? 'Player reinstated.'
        : null

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="flex flex-wrap gap-3 text-sm">
        {recordingModes.manualEntry && (
          <Link href={`/fitness/sessions/${session.id}`} className="text-blue-600 hover:underline">
            Manual Entry
          </Link>
        )}
        {recordingModes.liveDropout && (
          <Link
            href={`/fitness/sessions/${session.id}/live`}
            className="text-blue-600 hover:underline"
          >
            Live Dropout Mode
          </Link>
        )}
        <Link
          href={`/fitness/sessions/${session.id}/rankings`}
          className="text-blue-600 hover:underline"
        >
          Rankings
        </Link>
      </div>

      {savedMessage && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {savedMessage}
        </p>
      )}

      <section className="mt-6 rounded-xl border p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Live Timed Finish Mode</h1>
            <p className="mt-1 text-sm text-gray-500">
              {session.fitnessTestType.name} - {session.team.club.name} -{' '}
              {session.team.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {formatDate(session.date)}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getFitnessSessionStatusClasses(
                session.status
              )}`}
            >
              {formatFitnessSessionStatus(session.status)}
            </span>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-medium text-gray-500">Result unit</dt>
            <dd>{session.fitnessTestType.resultUnit}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Finished</dt>
            <dd>{players.filter((player) => player.result).length}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Unfinished</dt>
            <dd>{players.filter((player) => !player.result).length}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Started</dt>
            <dd>{formatDateTime(session.startedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Completed</dt>
            <dd>{formatDateTime(session.completedAt)}</dd>
          </div>
        </dl>

        {session.status === 'IN_PROGRESS' && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
            LIVE: record each player as they finish.
          </p>
        )}

        {session.status === 'COMPLETED' && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
            Fitness test completed{session.completedAt ? ` ${formatDateTime(session.completedAt)}` : ''}.
            Results are now read-only.
          </p>
        )}

        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          This mode is useful for longer timed tests. Manual precision entry is still
          preferred for short sprint and agility tests because phone tap timing may
          not be accurate enough for split-second results.
        </p>
      </section>

      {players.length === 0 ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-xl font-bold">No active players</h2>
          <p className="mt-2 text-sm text-gray-500">
            Add or restore active players before recording timed finishes.
          </p>
        </section>
      ) : (
        <FitnessTimerClient
          sessionId={session.id}
          resultUnit={session.fitnessTestType.resultUnit}
          higherIsBetter={session.fitnessTestType.higherIsBetter}
          rankingsHref={`/fitness/sessions/${session.id}/rankings`}
          isLive={session.status === 'IN_PROGRESS'}
          isCompleted={session.status === 'COMPLETED'}
          startedAt={session.startedAt?.toISOString() ?? null}
          completedAt={session.completedAt?.toISOString() ?? null}
          players={players}
          startSessionAction={startFitnessTestSession}
          endSessionAction={endFitnessTestSession}
          saveFinishAction={saveTimedFinish}
          undoFinishAction={undoTimedFinish}
        />
      )}
    </main>
  )
}
