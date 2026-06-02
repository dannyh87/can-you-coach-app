import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function userOwnsClub(userId: string, clubId: string) {
  const club = await prisma.club.findFirst({
    where: {
      id: clubId,
      userId,
    },
  })

  return Boolean(club)
}

async function createTeam(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')

  if (!clubId || !name || !ageGroup || !season) return
  if (!(await userOwnsClub(user.id, clubId))) return

  await prisma.team.create({
    data: {
      clubId,
      name,
      ageGroup,
      season,
    },
  })

  revalidatePath('/teams')
}

async function updateTeam(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')

  if (!id || !clubId || !name || !ageGroup || !season) return
  if (!(await userOwnsClub(user.id, clubId))) return

  const team = await prisma.team.findFirst({
    where: {
      id,
      club: {
        userId: user.id,
      },
    },
  })

  if (!team) return

  await prisma.team.update({
    where: { id },
    data: {
      clubId,
      name,
      ageGroup,
      season,
    },
  })

  revalidatePath('/teams')
}

async function deleteTeam(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return

  const team = await prisma.team.findFirst({
    where: {
      id,
      club: {
        userId: user.id,
      },
    },
  })

  if (!team) return
  await prisma.team.delete({ where: { id } })

  revalidatePath('/teams')
}

export default async function TeamsPage() {
  const user = await getLocalUser()
  await ensureDefaultClub(user.id)

  const clubs = await prisma.club.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  const teams = await prisma.team.findMany({
    where: {
      club: {
        userId: user.id,
      },
    },
    include: {
      club: true,
      _count: {
        select: {
          players: true,
          fitnessTestSessions: true,
        },
      },
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create squads inside clubs before adding players.
          </p>
        </div>

        <Link href="/clubs" className="text-sm text-blue-600 hover:underline">
          Manage Clubs
        </Link>
      </div>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 text-xl font-bold">Create Team</h2>

        <form action={createTeam} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">
            Club
            <select name="clubId" required className="mt-1 w-full rounded border p-2">
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Team name
            <input
              name="name"
              required
              className="mt-1 w-full rounded border p-2"
              placeholder="e.g. First Team"
            />
          </label>

          <label className="text-sm font-medium">
            Age group
            <input
              name="ageGroup"
              required
              className="mt-1 w-full rounded border p-2"
              placeholder="e.g. Open Age"
            />
          </label>

          <label className="text-sm font-medium">
            Season
            <input
              name="season"
              required
              className="mt-1 w-full rounded border p-2"
              placeholder="e.g. 2026/27"
            />
          </label>

          <div className="flex items-end">
            <button className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white">
              Create Team
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Existing Teams</h2>

        {teams.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-gray-500">
            No teams created yet.
          </p>
        ) : (
          teams.map((team) => (
            <article key={team.id} className="rounded-lg border p-4">
              <form action={updateTeam} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={team.id} />

                <label className="text-sm font-medium md:col-span-2">
                  Club
                  <select
                    name="clubId"
                    required
                    defaultValue={team.clubId}
                    className="mt-1 w-full rounded border p-2"
                  >
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Team name
                  <input
                    name="name"
                    required
                    defaultValue={team.name}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>

                <label className="text-sm font-medium">
                  Age group
                  <input
                    name="ageGroup"
                    required
                    defaultValue={team.ageGroup}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>

                <label className="text-sm font-medium">
                  Season
                  <input
                    name="season"
                    required
                    defaultValue={team.season}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>

                <div className="flex items-end">
                  <button className="w-full rounded bg-gray-900 px-4 py-2 font-medium text-white">
                    Save Team
                  </button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-gray-500">
                  {team._count.players} players · {team._count.fitnessTestSessions}{' '}
                  fitness sessions
                </span>

                <form action={deleteTeam}>
                  <input type="hidden" name="id" value={team.id} />
                  <button className="text-sm font-medium text-red-600 hover:underline">
                    Delete Team
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
