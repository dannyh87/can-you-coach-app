import ClubSetupClient from '@/app/club-setup/ClubSetupClient'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser, isClerkEnabled } from '@/lib/auth'
import { ensureDefaultClub } from '@/lib/localUser'
import { isOwnerForClub } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

type SetupActionResult =
  | { ok: true }
  | { ok: false; reason: string }

async function updateClub(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')
  const name = getTextValue(formData, 'name')
  const location = getTextValue(formData, 'location')
  const notes = getTextValue(formData, 'notes')

  if (!id || !name) {
    return { ok: false, reason: 'Club name is required.' }
  }

  if (!(await isOwnerForClub(user.id, id))) {
    return { ok: false, reason: 'You cannot update this club.' }
  }

  await prisma.club.update({
    where: { id },
    data: {
      name,
      location: location || null,
      notes: notes || null,
    },
  })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function createTeam(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')
  const league = getTextValue(formData, 'league')
  const footballPyramidStep = getTextValue(formData, 'footballPyramidStep')

  if (!clubId || !name || !ageGroup || !season) {
    return { ok: false, reason: 'Club, team name, age group and season are required.' }
  }

  if (!(await isOwnerForClub(user.id, clubId))) {
    return { ok: false, reason: 'You cannot add a team to this club.' }
  }

  await prisma.team.create({
    data: {
      clubId,
      name,
      ageGroup,
      season,
      league: league || null,
      footballPyramidStep: footballPyramidStep || null,
    },
  })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function updateTeam(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')
  const league = getTextValue(formData, 'league')
  const footballPyramidStep = getTextValue(formData, 'footballPyramidStep')

  if (!id || !clubId || !name || !ageGroup || !season) {
    return { ok: false, reason: 'Club, team name, age group and season are required.' }
  }

  if (!(await isOwnerForClub(user.id, clubId))) {
    return { ok: false, reason: 'You cannot move this team to that club.' }
  }

  const team = await prisma.team.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
      clubId: true,
    },
  })

  if (!team || !(await isOwnerForClub(user.id, team.clubId))) {
    return { ok: false, reason: 'Team was not found.' }
  }

  await prisma.team.update({
    where: { id },
    data: {
      clubId,
      name,
      ageGroup,
      season,
      league: league || null,
      footballPyramidStep: footballPyramidStep || null,
    },
  })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function deleteTeam(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing team.' }

  const team = await prisma.team.findFirst({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          players: true,
          fitnessTestSessions: true,
          matchDays: true,
        },
      },
    },
  })

  if (!team || !(await isOwnerForClub(user.id, team.clubId))) {
    return { ok: false, reason: 'Team was not found.' }
  }

  if (
    team._count.players > 0 ||
    team._count.fitnessTestSessions > 0 ||
    team._count.matchDays > 0
  ) {
    return {
      ok: false,
      reason: 'This team has players, fitness sessions or match days. Move or remove them before deleting.',
    }
  }

  await prisma.team.delete({ where: { id } })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

export default async function ClubSetupPage() {
  const user = await getCurrentUser()
  if (!isClerkEnabled()) await ensureDefaultClub(user.id)

  const ownerMemberships = await prisma.clubMembership.findMany({
    where: {
      userId: user.id,
      role: 'OWNER',
    },
    select: { clubId: true },
  })

  const clubs = await prisma.club.findMany({
    where: {
      id: {
        in: ownerMemberships.map((membership) => membership.clubId),
      },
    },
    include: {
      teams: {
        include: {
          _count: {
            select: {
              players: true,
              fitnessTestSessions: true,
              matchDays: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const clubRows = clubs.map((club) => ({
    id: club.id,
    name: club.name,
    location: club.location,
    notes: club.notes,
    teams: club.teams.map((team) => ({
      id: team.id,
      clubId: team.clubId,
      clubName: club.name,
      name: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      league: team.league,
      footballPyramidStep: team.footballPyramidStep,
      playerCount: team._count.players,
      fitnessSessionCount: team._count.fitnessTestSessions,
      matchDayCount: team._count.matchDays,
    })),
  }))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Club Setup"
        description="Add your club and teams once so the rest of the app is ready to use."
      />

      <ClubSetupClient
        clubs={clubRows}
        updateClubAction={updateClub}
        createTeamAction={createTeam}
        updateTeamAction={updateTeam}
        deleteTeamAction={deleteTeam}
      />
    </main>
  )
}
