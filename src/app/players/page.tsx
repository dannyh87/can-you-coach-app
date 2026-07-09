import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import PlayersClient from '@/app/players/PlayersClient'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { accessiblePlayerWhere, accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser, isClerkEnabled } from '@/lib/auth'
import { ensureDefaultClub } from '@/lib/localUser'
import { canManagePlayer, canManageTeamData } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

type PlayerActionResult =
  | { ok: true }
  | { ok: false; reason: string }

async function createPlayer(formData: FormData): Promise<PlayerActionResult> {
  'use server'

  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  const firstName = getTextValue(formData, 'firstName')
  const surname = getTextValue(formData, 'surname')
  const preferredPosition = getTextValue(formData, 'preferredPosition')
  const squadNumber = getOptionalNumberValue(formData, 'squadNumber')
  const dateOfBirth = getOptionalDateValue(formData, 'dateOfBirth')
  const joinedClubDate = getOptionalDateValue(formData, 'joinedClubDate')

  if (!teamId || !firstName || !surname) {
    return { ok: false, reason: 'Team and name are required.' }
  }

  if (!(await canManageTeamData(user.id, teamId))) {
    return { ok: false, reason: 'You cannot add a player to this team.' }
  }

  await prisma.player.create({
    data: {
      teamId,
      firstName,
      surname,
      squadNumber,
      preferredPosition: preferredPosition || null,
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

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')
  const teamId = getTextValue(formData, 'teamId')
  const firstName = getTextValue(formData, 'firstName')
  const surname = getTextValue(formData, 'surname')
  const preferredPosition = getTextValue(formData, 'preferredPosition')
  const squadNumber = getOptionalNumberValue(formData, 'squadNumber')
  const dateOfBirth = getOptionalDateValue(formData, 'dateOfBirth')
  const joinedClubDate = getOptionalDateValue(formData, 'joinedClubDate')

  if (!id || !teamId || !firstName || !surname) {
    return { ok: false, reason: 'Team and name are required.' }
  }

  if (!(await canManagePlayer(user.id, id))) {
    return { ok: false, reason: 'Player was not found.' }
  }

  if (!(await canManageTeamData(user.id, teamId))) {
    return { ok: false, reason: 'You cannot move this player to that team.' }
  }

  await prisma.player.update({
    where: { id },
    data: {
      teamId,
      firstName,
      surname,
      squadNumber,
      preferredPosition: preferredPosition || null,
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

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing player.' }
  if (!(await canManagePlayer(user.id, id))) {
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

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing player.' }
  if (!(await canManagePlayer(user.id, id))) {
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
  const user = await getCurrentUser()
  if (!isClerkEnabled()) await ensureDefaultClub(user.id)
  const manageableTeamIds = await getManageableTeamIds(user.id)
  const [spectatorAccessCount, membershipCount] = await Promise.all([
    prisma.spectatorAccess.count({ where: { userId: user.id } }),
    prisma.clubMembership.count({ where: { userId: user.id } }),
  ])

  const teams = await prisma.team.findMany({
    where: await accessibleTeamWhere(user.id),
    include: {
      club: true,
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const players = await prisma.player.findMany({
    where: await accessiblePlayerWhere(user.id),
    include: {
      team: {
        include: {
          club: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { surname: 'asc' }, { firstName: 'asc' }],
  })

  const teamOptions = teams.filter((team) => manageableTeamIds.includes(team.id)).map((team) => ({
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
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/players/import" className="text-blue-800 hover:underline">
              Import players
            </Link>
            <Link href="/club-setup" className="text-blue-800 hover:underline">
              Club Setup
            </Link>
          </div>
        )}
      />

      {teams.length === 0 ? (
        spectatorAccessCount > 0 ? (
          <EmptyState
            eyebrow="Linked player access"
            title="Your player access lives in My Player."
            description="Parents and spectators can view linked player information and submit match observations for linked players when a match is live. Coaches manage squads, fitness data and match setup."
            action={(
              <Link href="/my-player" className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Go to My Player
              </Link>
            )}
          />
        ) : membershipCount === 0 && user.onboardingRole === 'COACH' ? (
          <EmptyState
            eyebrow="Team invite needed"
            title="Ask your club for a team invite."
            description="Open the invite link directly and sign in with the email address that was invited. Your squad will appear here after the invite is accepted."
          />
        ) : membershipCount === 0 && user.onboardingRole === 'PARENT_SPECTATOR' ? (
          <EmptyState
            eyebrow="Player invite needed"
            title="Waiting for your player link."
            description="Ask your coach or club official to invite you to a player. Once accepted, your player will appear in My Player."
            action={(
              <Link href="/my-player" className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Go to My Player
              </Link>
            )}
          />
        ) : (
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
        )
      ) : (
        <PlayersClient
          players={playerRows}
          teams={teamOptions}
          canManagePlayers={teamOptions.length > 0}
          createPlayerAction={createPlayer}
          updatePlayerAction={updatePlayer}
          archivePlayerAction={archivePlayer}
          restorePlayerAction={restorePlayer}
        />
      )}
    </main>
  )
}
