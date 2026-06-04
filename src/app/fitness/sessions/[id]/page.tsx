import type { FitnessResultStatus } from '@prisma/client'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import { getLocalUser } from '@/lib/localUser'
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
  })

  if (!session) return

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
  revalidatePath('/fitness')
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

export default async function FitnessSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

      <section className="mt-6 rounded-xl border p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{session.fitnessTestType.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {session.team.club.name} - {session.team.name}
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
        </dl>

        {session.notes && (
          <p className="mt-4 text-sm text-gray-600">{session.notes}</p>
        )}

        <Link
          href={`/fitness/sessions/${session.id}/rankings`}
          className="mt-4 inline-flex rounded border px-4 py-2 text-sm font-medium"
        >
          View Rankings
        </Link>
      </section>

      {activePlayers.length === 0 ? (
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
                    #{player.squadNumber} - {player.preferredPosition ?? 'No position'}
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
