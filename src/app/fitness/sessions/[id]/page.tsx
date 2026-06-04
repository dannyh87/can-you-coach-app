import type { FitnessResultStatus } from '@prisma/client'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { getLocalUser } from '@/lib/localUser'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import {
  formatFitnessSessionStatus,
  getFitnessSessionStatusClasses,
} from '@/lib/fitnessSessionStatus'
import { prisma } from '@/lib/prisma'

const statusOptions: { label: string; value: FitnessResultStatus }[] = [
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Did not start', value: 'DID_NOT_START' },
  { label: 'Injured', value: 'INJURED' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Dropped out', value: 'DROPPED_OUT' },
]

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

const getStatusValue = (formData: FormData, key: string) => {
  const value = getTextValue(formData, key)
  const status = statusOptions.find((option) => option.value === value)
  return status?.value ?? 'COMPLETED'
}

async function saveFitnessResults(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const fitnessTestSessionId = getTextValue(formData, 'fitnessTestSessionId')

  if (!fitnessTestSessionId) return

  const session = await prisma.fitnessTestSession.findFirst({
    where: {
      id: fitnessTestSessionId,
      team: {
        club: {
          userId: user.id,
        },
      },
    },
    include: { fitnessTestType: true },
  })

  if (!session) return
  if (!getFitnessRecordingModes(session.fitnessTestType).manualEntry) return

  const activePlayers = await prisma.player.findMany({
    where: {
      teamId: session.teamId,
      isActive: true,
    },
    select: { id: true },
  })

  const existingResults = await prisma.fitnessTestResult.findMany({
    where: { fitnessTestSessionId: session.id },
    select: { playerId: true },
  })
  const existingResultPlayerIds = new Set(
    existingResults.map((result) => result.playerId)
  )

  for (const player of activePlayers) {
    const resultValue = getOptionalFloatValue(formData, `resultValue-${player.id}`)
    const resultText = getTextValue(formData, `resultText-${player.id}`)
    const notes = getTextValue(formData, `notes-${player.id}`)
    const status = getStatusValue(formData, `status-${player.id}`)
    const hasExistingResult = existingResultPlayerIds.has(player.id)
    const hasResultData =
      resultValue !== null || resultText || notes || status !== 'COMPLETED'

    if (!hasExistingResult && !hasResultData) continue

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
        notes: notes || null,
        status,
      },
      create: {
        fitnessTestSessionId: session.id,
        playerId: player.id,
        resultValue,
        resultText: resultText || null,
        notes: notes || null,
        status,
      },
    })
  }

  revalidatePath(`/fitness/sessions/${session.id}`)
  revalidatePath(`/fitness/sessions/${session.id}/rankings`)
  revalidatePath('/fitness/progress')
  revalidatePath('/fitness')

  redirect(`/fitness/sessions/${session.id}?saved=1`)
}

async function startFitnessTestSession(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const fitnessTestSessionId = getTextValue(formData, 'fitnessTestSessionId')

  if (!fitnessTestSessionId) return

  const session = await prisma.fitnessTestSession.findFirst({
    where: {
      id: fitnessTestSessionId,
      team: {
        club: {
          userId: user.id,
        },
      },
    },
  })

  if (!session || session.status !== 'DRAFT') return

  await prisma.fitnessTestSession.update({
    where: { id: session.id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  })

  revalidatePath('/fitness')
  revalidatePath(`/fitness/sessions/${session.id}`)
  revalidatePath(`/fitness/sessions/${session.id}/live`)
  revalidatePath(`/fitness/sessions/${session.id}/timer`)

  redirect(`/fitness/sessions/${session.id}?started=1`)
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

const formatDateTime = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
    : 'Not started'

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

export default async function FitnessSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; started?: string }>
}) {
  const { id } = await params
  const { saved, started } = await searchParams
  const user = await getLocalUser()

  const session = await prisma.fitnessTestSession.findFirst({
    where: {
      id,
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

  if (!session) notFound()
  const recordingModes = getFitnessRecordingModes(session.fitnessTestType)

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

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <Link href="/fitness" className="text-sm text-blue-600 hover:underline">
        Back to Fitness
      </Link>

      {saved === '1' && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Results saved successfully.
        </p>
      )}

      {started === '1' && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Fitness test started.
        </p>
      )}

      <section className="mt-6 rounded-xl border p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{session.fitnessTestType.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {session.team.club.name} - {session.team.name}
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
            <dt className="font-medium text-gray-500">Ranking direction</dt>
            <dd>
              {session.fitnessTestType.higherIsBetter
                ? 'Higher is better'
                : 'Lower is better'}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">Saved results</dt>
            <dd>{existingResults.length}</dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">Started</dt>
            <dd>{formatDateTime(session.startedAt)}</dd>
          </div>
        </dl>

        {session.notes && (
          <p className="mt-4 text-sm text-gray-600">{session.notes}</p>
        )}

        {session.status === 'DRAFT' && (
          <form action={startFitnessTestSession} className="mt-4">
            <input type="hidden" name="fitnessTestSessionId" value={session.id} />
            <button className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white">
              Start Fitness Test
            </button>
          </form>
        )}

        {session.status === 'IN_PROGRESS' && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
            This fitness test is live.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {recordingModes.manualEntry && (
            <Link
              href={`/fitness/sessions/${session.id}`}
              className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Manual Entry
            </Link>
          )}
          {recordingModes.liveDropout && (
            <Link
              href={`/fitness/sessions/${session.id}/live`}
              className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Live Dropout Mode
            </Link>
          )}
          {recordingModes.liveTimedFinish && (
            <Link
              href={`/fitness/sessions/${session.id}/timer`}
              className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Live Timed Finish Mode
            </Link>
          )}
          <Link
            href={`/fitness/sessions/${session.id}/rankings`}
            className="inline-flex rounded border px-4 py-2 text-sm font-medium"
          >
            Rankings
          </Link>
        </div>
      </section>

      {!recordingModes.manualEntry ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-xl font-bold">Manual entry is not used for this test</h2>
          <p className="mt-2 text-sm text-gray-500">
            Use the valid recording mode shown above for {session.fitnessTestType.name}.
          </p>
        </section>
      ) : activePlayers.length === 0 ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-xl font-bold">No active players</h2>
          <p className="mt-2 text-sm text-gray-500">
            Add or restore active players before entering results for this team.
          </p>
          <Link
            href="/players"
            className="mt-4 inline-flex rounded bg-blue-600 px-4 py-2 font-medium text-white"
          >
            Go to Players
          </Link>
        </section>
      ) : (
        <form action={saveFitnessResults} className="mt-6 space-y-4">
          <input type="hidden" name="fitnessTestSessionId" value={session.id} />

          <div>
            <h2 className="text-xl font-bold">Enter Results</h2>
            <p className="mt-1 text-sm text-gray-500">
              Archived players are excluded from this list.
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Manual precision entry is preferred for short sprint and agility tests.
              Phone tap timing may not be accurate enough for precise split-second
              results, so use a stopwatch or timing gates and enter the exact value here.
            </p>
          </div>

          {activePlayers.map((player) => {
            const result = resultsByPlayerId.get(player.id)

            return (
              <article key={player.id} className="rounded-lg border p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-bold">
                    {player.firstName} {player.surname}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatSquadNumber(player.squadNumber)} -{' '}
                    {player.preferredPosition ?? 'No position'}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium">
                    Numeric result
                    <input
                      name={`resultValue-${player.id}`}
                      type="number"
                      step="any"
                      defaultValue={result?.resultValue ?? ''}
                      className="mt-1 w-full rounded border p-3 text-base"
                      placeholder={session.fitnessTestType.resultUnit}
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Display result
                    <input
                      name={`resultText-${player.id}`}
                      defaultValue={result?.resultText ?? ''}
                      className="mt-1 w-full rounded border p-3 text-base"
                      placeholder="e.g. Level 17.2"
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Status
                    <select
                      name={`status-${player.id}`}
                      defaultValue={result?.status ?? 'COMPLETED'}
                      className="mt-1 w-full rounded border p-3 text-base"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium">
                    Notes
                    <input
                      name={`notes-${player.id}`}
                      defaultValue={result?.notes ?? ''}
                      className="mt-1 w-full rounded border p-3 text-base"
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </article>
            )
          })}

          <button className="w-full rounded bg-blue-600 px-4 py-3 text-lg font-medium text-white">
            Save Results
          </button>
        </form>
      )}
    </main>
  )
}
