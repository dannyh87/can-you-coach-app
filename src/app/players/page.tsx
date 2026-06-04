import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const positions = [
  'Goalkeeper',
  'Right Back',
  'Centre Back',
  'Left Back',
  'Defensive Midfielder',
  'Central Midfielder',
  'Attacking Midfielder',
  'Right Wing',
  'Left Wing',
  'Striker',
]

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

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const getOptionalDateValue = (formData: FormData, key: string) => {
  const value = getTextValue(formData, key)
  return value ? new Date(`${value}T00:00:00`) : null
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

async function createPlayer(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const teamId = getTextValue(formData, 'teamId')
  const firstName = getTextValue(formData, 'firstName')
  const surname = getTextValue(formData, 'surname')
  const preferredPosition = getTextValue(formData, 'preferredPosition')
  const squadNumber = getOptionalNumberValue(formData, 'squadNumber')
  const dateOfBirth = getOptionalDateValue(formData, 'dateOfBirth')
  const joinedClubDate = getOptionalDateValue(formData, 'joinedClubDate')

  if (!teamId || !firstName || !surname || !preferredPosition) return
  if (!(await userOwnsTeam(user.id, teamId))) return

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
}

async function updatePlayer(formData: FormData) {
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

  if (!id || !teamId || !firstName || !surname || !preferredPosition) return
  if (!(await userOwnsPlayer(user.id, id))) return
  if (!(await userOwnsTeam(user.id, teamId))) return

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
}

async function archivePlayer(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return
  if (!(await userOwnsPlayer(user.id, id))) return

  await prisma.player.update({
    where: { id },
    data: { isActive: false },
  })

  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
}

async function restorePlayer(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return
  if (!(await userOwnsPlayer(user.id, id))) return

  await prisma.player.update({
    where: { id },
    data: { isActive: true },
  })

  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
}

const formatDateInputValue = (date: Date | null) => {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

type TeamOption = {
  id: string
  name: string
  club: {
    name: string
  }
}

type PlayerWithTeam = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  preferredPosition: string | null
  dateOfBirth: Date | null
  joinedClubDate: Date | null
  isActive: boolean
  teamId: string
  team: {
    name: string
    club: {
      name: string
    }
  }
}

function PlayerForm({
  action,
  teams,
  player,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>
  teams: TeamOption[]
  player?: PlayerWithTeam
  submitLabel: string
}) {
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      {player && <input type="hidden" name="id" value={player.id} />}

      <label className="text-sm font-medium md:col-span-2">
        Team
        <select
          name="teamId"
          required
          defaultValue={player?.teamId}
          className="mt-1 w-full rounded border p-2"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.club.name} - {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        First name
        <input
          name="firstName"
          required
          defaultValue={player?.firstName ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Surname
        <input
          name="surname"
          required
          defaultValue={player?.surname ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Squad number optional
        <input
          name="squadNumber"
          type="number"
          min="0"
          defaultValue={player?.squadNumber ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Preferred position
        <select
          name="preferredPosition"
          required
          defaultValue={player?.preferredPosition ?? ''}
          className="mt-1 w-full rounded border p-2"
        >
          <option value="" disabled>
            Select position
          </option>
          {positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Date of birth
        <input
          name="dateOfBirth"
          type="date"
          defaultValue={formatDateInputValue(player?.dateOfBirth ?? null)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Joined club date
        <input
          name="joinedClubDate"
          type="date"
          defaultValue={formatDateInputValue(player?.joinedClubDate ?? null)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <div className="flex items-end md:col-span-2">
        <button className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function PlayerCard({
  player,
  teams,
  archived,
}: {
  player: PlayerWithTeam
  teams: TeamOption[]
  archived?: boolean
}) {
  return (
    <article className="rounded-lg border p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/players/${player.id}`}
            className="text-lg font-bold hover:underline"
          >
            {player.firstName} {player.surname}
          </Link>
          <p className="mt-1 text-sm text-gray-500">
            {formatSquadNumber(player.squadNumber)} - {player.preferredPosition} -{' '}
            {player.team.club.name} / {player.team.name}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            archived
              ? 'bg-gray-100 text-gray-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {archived ? 'Archived' : 'Active'}
        </span>
      </div>

      <PlayerForm
        action={updatePlayer}
        teams={teams}
        player={player}
        submitLabel="Save Player"
      />

      <form action={archived ? restorePlayer : archivePlayer} className="mt-3">
        <input type="hidden" name="id" value={player.id} />
        <button
          className={`text-sm font-medium hover:underline ${
            archived ? 'text-blue-600' : 'text-red-600'
          }`}
        >
          {archived ? 'Restore Player' : 'Archive Player'}
        </button>
      </form>
    </article>
  )
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

  const activePlayers = await prisma.player.findMany({
    where: {
      isActive: true,
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
    orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
  })

  const archivedPlayers = await prisma.player.findMany({
    where: {
      isActive: false,
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
    orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
  })

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Players</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage players inside the club and team hierarchy.
          </p>
        </div>

        <Link href="/teams" className="text-sm text-blue-600 hover:underline">
          Manage Teams
        </Link>
      </div>

      {teams.length === 0 ? (
        <section className="rounded-lg border p-4">
          <h2 className="text-xl font-bold">Create a team first</h2>
          <p className="mt-2 text-sm text-gray-500">
            Players must belong to a team. Create a team before adding players.
          </p>
          <Link
            href="/teams"
            className="mt-4 inline-flex rounded bg-blue-600 px-4 py-2 font-medium text-white"
          >
            Go to Teams
          </Link>
        </section>
      ) : (
        <>
          <section className="mb-8 rounded-lg border p-4">
            <h2 className="mb-4 text-xl font-bold">Create Player</h2>
            <PlayerForm
              action={createPlayer}
              teams={teams}
              submitLabel="Create Player"
            />
          </section>

          <section className="mb-8 space-y-4">
            <div>
              <h2 className="text-xl font-bold">Active Players</h2>
              <p className="mt-1 text-sm text-gray-500">
                Active players are available for future team and fitness workflows.
              </p>
            </div>

            {activePlayers.length === 0 ? (
              <p className="rounded-lg border p-4 text-sm text-gray-500">
                No active players yet.
              </p>
            ) : (
              activePlayers.map((player) => (
                <PlayerCard key={player.id} player={player} teams={teams} />
              ))
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Archived Players</h2>
              <p className="mt-1 text-sm text-gray-500">
                Archived players are kept for history but are not active squad members.
              </p>
            </div>

            {archivedPlayers.length === 0 ? (
              <p className="rounded-lg border p-4 text-sm text-gray-500">
                No archived players.
              </p>
            ) : (
              archivedPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  teams={teams}
                  archived
                />
              ))
            )}
          </section>
        </>
      )}
    </main>
  )
}
