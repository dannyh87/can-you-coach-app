import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

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
  revalidatePath(`/fitness/sessions/${sessionId}/live`)
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

async function saveDropoutResult(formData: FormData) {
  'use server'

  const sessionId = getTextValue(formData, 'fitnessTestSessionId')
  const playerId = getTextValue(formData, 'playerId')
  const resultValue = getOptionalFloatValue(formData, 'resultValue')
  const resultText = getTextValue(formData, 'resultText')

  if (!sessionId || !playerId) return

  const session = await getOwnedSession(sessionId)
  if (!session) return

  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      teamId: session.teamId,
      isActive: true,
    },
    select: { id: true },
  })

  if (!player) return

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
      status: 'DROPPED_OUT',
    },
    create: {
      fitnessTestSessionId: session.id,
      playerId: player.id,
      resultValue,
      resultText: resultText || null,
      status: 'DROPPED_OUT',
    },
  })

  revalidateFitnessSessionPaths(session.id)
}

async function undoDropoutResult(formData: FormData) {
  'use server'

  const sessionId = getTextValue(formData, 'fitnessTestSessionId')
  const playerId = getTextValue(formData, 'playerId')

  if (!sessionId || !playerId) return

  const session = await getOwnedSession(sessionId)
  if (!session) return

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
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

const formatResult = (result: { resultValue: number | null; resultText: string | null }) => {
  if (result.resultText) return result.resultText
  if (result.resultValue !== null) return String(result.resultValue)
  return 'Recorded'
}

export default async function FitnessLiveDropoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getOwnedSession(id)

  if (!session) notFound()

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

  const recordedCount = activePlayers.filter((player) =>
    resultsByPlayerId.has(player.id)
  ).length

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/fitness/sessions/${session.id}`} className="text-blue-600 hover:underline">
          Manual Entry
        </Link>
        <Link
          href={`/fitness/sessions/${session.id}/timer`}
          className="text-blue-600 hover:underline"
        >
          Live Timed Finish Mode
        </Link>
        <Link
          href={`/fitness/sessions/${session.id}/rankings`}
          className="text-blue-600 hover:underline"
        >
          Rankings
        </Link>
      </div>

      <section className="mt-6 rounded-xl border p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Live Dropout Mode</h1>
            <p className="mt-1 text-sm text-gray-500">
              {session.fitnessTestType.name} - {session.team.club.name} -{' '}
              {session.team.name}
            </p>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {formatDate(session.date)}
          </span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-gray-500">Result unit</dt>
            <dd>{session.fitnessTestType.resultUnit}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Still active</dt>
            <dd>{activePlayers.length - recordedCount}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Dropped out</dt>
            <dd>{recordedCount}</dd>
          </div>
        </dl>

        <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Use this mode for staged endurance tests. Enter the current level, stage, or
          distance on the player card, then record the player when they drop out.
          Archived players are excluded.
        </p>
      </section>

      {activePlayers.length === 0 ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-xl font-bold">No active players</h2>
          <p className="mt-2 text-sm text-gray-500">
            Add or restore active players before recording live dropouts.
          </p>
        </section>
      ) : (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {activePlayers.map((player) => {
            const result = resultsByPlayerId.get(player.id)
            const hasResult = Boolean(result)

            return (
              <article
                key={player.id}
                className={`rounded-lg border p-4 ${
                  hasResult ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50'
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      {player.firstName} {player.surname}
                    </h2>
                    <p className="text-sm text-gray-500">
                      #{player.squadNumber} - {player.preferredPosition ?? 'No position'}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                    {hasResult ? formatResult(result) : 'Still in'}
                  </span>
                </div>

                {hasResult ? (
                  <form action={undoDropoutResult}>
                    <input type="hidden" name="fitnessTestSessionId" value={session.id} />
                    <input type="hidden" name="playerId" value={player.id} />
                    <button className="w-full rounded border border-red-300 bg-white px-4 py-3 font-medium text-red-700">
                      Undo / Reinstate
                    </button>
                  </form>
                ) : (
                  <form action={saveDropoutResult} className="grid gap-3">
                    <input type="hidden" name="fitnessTestSessionId" value={session.id} />
                    <input type="hidden" name="playerId" value={player.id} />
                    <label className="text-sm font-medium">
                      Numeric result
                      <input
                        name="resultValue"
                        type="number"
                        step="any"
                        className="mt-1 w-full rounded border p-3 text-base"
                        placeholder={session.fitnessTestType.resultUnit}
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Display result
                      <input
                        name="resultText"
                        className="mt-1 w-full rounded border p-3 text-base"
                        placeholder="e.g. Level 12.4"
                      />
                    </label>
                    <button className="w-full rounded bg-green-700 px-4 py-3 font-medium text-white">
                      Record Dropout
                    </button>
                  </form>
                )}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
