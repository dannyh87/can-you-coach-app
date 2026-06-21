import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import PlayersClient from '@/app/players/PlayersClient'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getOptionalNumberValue = (formData: FormData, key: string) => {
  const value = getTextValue(formData, key)
  if (!value) return null

  const numberValue = Number(value)
  return Number.isInteger(numberValue) ? numberValue : null
}

const getOptionalDateValue = (formData: FormData, key: string) => {
  const value = getTextValue(formData, key)
  return value ? new Date(`${value}T00:00:00`) : null
}

const formatDateInputValue = (date: Date | null) => {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

const formatDateDisplayValue = (date: Date | null) => {
  if (!date) return 'Not set'
  return new Intl.DateTimeFormat('en-GB').format(date)
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

async function userOwnsPlayer(userId: string, playerId: string) {
  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      team: {
        club: {
          userId,
        },
      },
    },
  })

  return Boolean(player)
}

type PlayerActionResult =
  | { ok: true }
  | { ok: false; reason: string }

async function createPlayer(formData: FormData): Promise<PlayerActionResult> {
  'use server'

  const user = await getLocalUser()
  const teamId = getTextValue(formData, 'teamId')
  const firstName = getTextValue(formData, 'firstName')
  const surname = getTextValue(formData, 'surname')
  const preferredPosition = getTextValue(formData, 'preferredPosition')
  const squadNumber = getOptionalNumberValue(formData, 'squadNumber')
  const dateOfBirth = getOptionalDateValue(formData, 'dateOfBirth')
  const joinedClubDate = getOptionalDateValue(formData, 'joinedClubDate')

  if (!teamId || !firstName || !surname || !preferredPosition) {
    return { ok: false, reason: 'Team, name and position are required.' }
  }

  if (!(await userOwnsTeam(user.id, teamId))) {
    return { ok: false, reason: 'You cannot add a player to this team.' }
  }

  await prisma.player.create({
    data: {
      teamId,
      firstName,
      surname,
      squadNumber,
      preferredPosition,
      dateOfBirth,
      joinedClubDate,
      isActive: true,
    },
  })

  revalidatePath('/players')
  return { ok: true }
}

async function updatePlayer(formData: FormData): Promise<PlayerActionResult> {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')
  const teamId = getTextValue(formData, 'teamId')
  const firstName = getTextValue(formData, 'firstName')
  const surname = getTextValue(formData, 'surname')
  const preferredPosition = getTextValue(formData, 'preferredPosition')
  const squadNumber = getOptionalNumberValue(formData, 'squadNumber')
  const dateOfBirth = getOptionalDateValue(formData, 'dateOfBirth')
  const joinedClubDate = getOptionalDateValue(formData, 'joinedClubDate')

  if (!id || !teamId || !firstName || !surname || !preferredPosition) {
    return { ok: false, reason: 'Team, name and position are required.' }
  }

  if (!(await userOwnsPlayer(user.id, id))) {
    return { ok: false, reason: 'Player was not found.' }
  }

  if (!(await userOwnsTeam(user.id, teamId))) {
    return { ok: false, reason: 'You cannot move this player to that team.' }
  }

  await prisma.player.update({
    where: { id },
    data: {
      teamId,
      firstName,
      surname,
      squadNumber,
      preferredPosition,
      dateOfBirth,
      joinedClubDate,
    },
  })

  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
  return { ok: true }
}

async function archivePlayer(formData: FormData): Promise<PlayerActionResult> {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing player.' }
  if (!(await userOwnsPlayer(user.id, id))) {
    return { ok: false, reason: 'Player was not found.' }
  }

  await prisma.player.update({
    where: { id },
    data: { isActive: false },
  })

  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
  return { ok: true }
}

async function restorePlayer(formData: FormData): Promise<PlayerActionResult> {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing player.' }
  if (!(await userOwnsPlayer(user.id, id))) {
    return { ok: false, reason: 'Player was not found.' }
  }

  await prisma.player.update({
    where: { id },
    data: { isActive: true },
  })

  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
  return { ok: true }
}

export default async function PlayersPage() {
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

  const players = await prisma.player.findMany({
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
    },
    orderBy: [{ isActive: 'desc' }, { surname: 'asc' }, { firstName: 'asc' }],
  })

  const teamOptions = teams.map((team) => ({
    id: team.id,
    name: team.name,
    clubName: team.club.name,
  }))

  const playerRows = players.map((player) => ({
    id: player.id,
    firstName: player.firstName,
    surname: player.surname,
    squadNumber: player.squadNumber,
    preferredPosition: player.preferredPosition,
    dateOfBirthInput: formatDateInputValue(player.dateOfBirth),
    dateOfBirthDisplay: formatDateDisplayValue(player.dateOfBirth),
    joinedClubDateInput: formatDateInputValue(player.joinedClubDate),
    joinedClubDateDisplay: formatDateDisplayValue(player.joinedClubDate),
    isActive: player.isActive,
    teamId: player.teamId,
    teamName: player.team.name,
    clubName: player.team.club.name,
  }))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Players"
        description="Keep your squad list ready for training, fitness testing and match day tracking."
        actions={(
          <Link href="/club-setup" className="text-sm font-semibold text-blue-800 hover:underline">
            Club Setup
          </Link>
        )}
      />

      {teams.length === 0 ? (
        <EmptyState
          title="Create a team first"
          description="Players need a team before they can be added. Set up your club and team first."
          action={(
          <Link
            href="/club-setup"
            className="inline-flex"
          >
            <Button>Go to Club Setup</Button>
          </Link>
          )}
        />
      ) : (
        <PlayersClient
          players={playerRows}
          teams={teamOptions}
          createPlayerAction={createPlayer}
          updatePlayerAction={updatePlayer}
          archivePlayerAction={archivePlayer}
          restorePlayerAction={restorePlayer}
        />
      )}
    </main>
  )
}
