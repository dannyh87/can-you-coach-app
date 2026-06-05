import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import TeamsClient from '@/app/teams/TeamsClient'
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

type TeamActionResult =
  | { ok: true }
  | { ok: false; reason: string }

async function createTeam(formData: FormData): Promise<TeamActionResult> {
  'use server'

  const user = await getLocalUser()
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')

  if (!clubId || !name || !ageGroup || !season) {
    return { ok: false, reason: 'Club, team name, age group and season are required.' }
  }

  if (!(await userOwnsClub(user.id, clubId))) {
    return { ok: false, reason: 'You cannot add a team to this club.' }
  }

  await prisma.team.create({
    data: {
      clubId,
      name,
      ageGroup,
      season,
    },
  })

  revalidatePath('/teams')
  return { ok: true }
}

async function updateTeam(formData: FormData): Promise<TeamActionResult> {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')

  if (!id || !clubId || !name || !ageGroup || !season) {
    return { ok: false, reason: 'Club, team name, age group and season are required.' }
  }

  if (!(await userOwnsClub(user.id, clubId))) {
    return { ok: false, reason: 'You cannot move this team to that club.' }
  }

  const team = await prisma.team.findFirst({
    where: {
      id,
      club: {
        userId: user.id,
      },
    },
  })

  if (!team) return { ok: false, reason: 'Team was not found.' }

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
  return { ok: true }
}

async function deleteTeam(formData: FormData): Promise<TeamActionResult> {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing team.' }

  const team = await prisma.team.findFirst({
    where: {
      id,
      club: {
        userId: user.id,
      },
    },
    include: {
      _count: {
        select: {
          players: true,
          fitnessTestSessions: true,
        },
      },
    },
  })

  if (!team) return { ok: false, reason: 'Team was not found.' }

  if (team._count.players > 0 || team._count.fitnessTestSessions > 0) {
    return {
      ok: false,
      reason: 'This team has players or fitness sessions. Move or remove them before deleting.',
    }
  }

  await prisma.team.delete({ where: { id } })

  revalidatePath('/teams')
  return { ok: true }
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

  const clubOptions = clubs.map((club) => ({
    id: club.id,
    name: club.name,
  }))

  const teamRows = teams.map((team) => ({
    id: team.id,
    clubId: team.clubId,
    clubName: team.club.name,
    name: team.name,
    ageGroup: team.ageGroup,
    season: team.season,
    playerCount: team._count.players,
    fitnessSessionCount: team._count.fitnessTestSessions,
  }))

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
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

      <TeamsClient
        teams={teamRows}
        clubs={clubOptions}
        createTeamAction={createTeam}
        updateTeamAction={updateTeam}
        deleteTeamAction={deleteTeam}
      />
    </main>
  )
}
