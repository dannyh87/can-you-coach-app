import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function userOwnsTeam(userId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      club: {
        userId,
      },
    },
  })

  return Boolean(team)
}

async function userCanUseFitnessTestType(userId: string, fitnessTestTypeId: string) {
  const fitnessTestType = await prisma.fitnessTestType.findFirst({
    where: {
      id: fitnessTestTypeId,
      OR: [{ isDefault: true }, { userId }],
    },
  })

  return Boolean(fitnessTestType)
}

async function createFitnessTestSession(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const teamId = getTextValue(formData, 'teamId')
  const fitnessTestTypeId = getTextValue(formData, 'fitnessTestTypeId')
  const date = getTextValue(formData, 'date')
  const notes = getTextValue(formData, 'notes')

  if (!teamId || !fitnessTestTypeId || !date) return
  if (!(await userOwnsTeam(user.id, teamId))) return
  if (!(await userCanUseFitnessTestType(user.id, fitnessTestTypeId))) return

  await prisma.fitnessTestSession.create({
    data: {
      teamId,
      fitnessTestTypeId,
      date: new Date(`${date}T00:00:00`),
      notes: notes || null,
    },
  })

  revalidatePath('/fitness')
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

export default async function FitnessPage() {
  const user = await getLocalUser()
  await ensureDefaultClub(user.id)

  const teams = await prisma.team.findMany({
    where: {
      club: {
        userId: user.id,
      },
    },
    include: {
      club: true,
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const fitnessTestTypes = await prisma.fitnessTestType.findMany({
    where: {
      OR: [{ isDefault: true }, { userId: user.id }],
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const sessions = await prisma.fitnessTestSession.findMany({
    where: {
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
      _count: {
        select: {
          results: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fitness Testing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create fitness test sessions for teams and enter player results.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/fitness/progress" className="text-blue-600 hover:underline">
            View Progress
          </Link>
          <Link href="/teams" className="text-blue-600 hover:underline">
            Manage Teams
          </Link>
        </div>
      </div>

      {teams.length === 0 ? (
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="text-xl font-bold">Create a team first</h2>
          <p className="mt-2 text-sm text-gray-500">
            Fitness test sessions must belong to a team.
          </p>
          <Link
            href="/teams"
            className="mt-4 inline-flex rounded bg-blue-600 px-4 py-2 font-medium text-white"
          >
            Go to Teams
          </Link>
        </section>
      ) : fitnessTestTypes.length === 0 ? (
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="text-xl font-bold">No fitness test types found</h2>
          <p className="mt-2 text-sm text-gray-500">
            Run the Prisma seed command to create the default fitness test types.
          </p>
        </section>
      ) : (
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="mb-4 text-xl font-bold">Create Test Session</h2>

          <form action={createFitnessTestSession} className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">
              Team
              <select name="teamId" required className="mt-1 w-full rounded border p-2">
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.club.name} - {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Test type
              <select
                name="fitnessTestTypeId"
                required
                className="mt-1 w-full rounded border p-2"
              >
                {fitnessTestTypes.map((fitnessTestType) => (
                  <option key={fitnessTestType.id} value={fitnessTestType.id}>
                    {fitnessTestType.name} ({fitnessTestType.resultUnit})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="mt-1 w-full rounded border p-2"
              />
            </label>

            <label className="text-sm font-medium md:col-span-2">
              Notes
              <textarea
                name="notes"
                className="mt-1 w-full rounded border p-2"
                placeholder="Optional"
                rows={3}
              />
            </label>

            <div className="flex items-end md:col-span-2">
              <button className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white">
                Create Test Session
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Previous Test Sessions</h2>

        {sessions.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-gray-500">
            No fitness test sessions yet.
          </p>
        ) : (
          sessions.map((session) => (
            <article key={session.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{session.fitnessTestType.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {session.team.club.name} - {session.team.name}
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {session._count.results} results
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-gray-500">Date</dt>
                  <dd>{formatDate(session.date)}</dd>
                </div>

                <div>
                  <dt className="font-medium text-gray-500">Unit</dt>
                  <dd>{session.fitnessTestType.resultUnit}</dd>
                </div>

                <div>
                  <dt className="font-medium text-gray-500">Ranking</dt>
                  <dd>
                    {session.fitnessTestType.higherIsBetter
                      ? 'Higher is better'
                      : 'Lower is better'}
                  </dd>
                </div>
              </dl>

              {session.notes && (
                <p className="mt-4 text-sm text-gray-600">{session.notes}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/fitness/sessions/${session.id}`}
                  className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Manual Entry
                </Link>

                <Link
                  href={`/fitness/sessions/${session.id}/live`}
                  className="inline-flex rounded border px-4 py-2 text-sm font-medium"
                >
                  Live Dropout Mode
                </Link>

                <Link
                  href={`/fitness/sessions/${session.id}/timer`}
                  className="inline-flex rounded border px-4 py-2 text-sm font-medium"
                >
                  Live Timed Finish Mode
                </Link>

                <Link
                  href={`/fitness/sessions/${session.id}/rankings`}
                  className="inline-flex rounded border px-4 py-2 text-sm font-medium"
                >
                  Rankings
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
