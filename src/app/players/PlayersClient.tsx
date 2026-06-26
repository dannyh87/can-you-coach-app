'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  dataTableRowClassName,
} from '@/components/ui/DataTable'
import FormField from '@/components/ui/FormField'
import ModalShell from '@/components/ui/ModalShell'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'
import { playerPositions } from '@/lib/playerPositions'

type PlayerActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type PlayerAction = (formData: FormData) => Promise<PlayerActionResult>

type TeamOption = {
  id: string
  name: string
  clubName: string
}

type PlayerRow = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  preferredPosition: string | null
  dateOfBirthInput: string
  dateOfBirthDisplay: string
  joinedClubDateInput: string
  joinedClubDateDisplay: string
  isActive: boolean
  teamId: string
  teamName: string
  clubName: string
}

type ModalMode = 'add' | 'detail' | 'edit' | null
type PlayerSortOption =
  | 'nameAsc'
  | 'nameDesc'
  | 'teamAsc'
  | 'positionAsc'
  | 'squadAsc'
  | 'squadDesc'
  | 'activeFirst'
  | 'archivedFirst'

type PlayersClientProps = {
  players: PlayerRow[]
  teams: TeamOption[]
  createPlayerAction: PlayerAction
  updatePlayerAction: PlayerAction
  archivePlayerAction: PlayerAction
  restorePlayerAction: PlayerAction
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'Not set' : `#${squadNumber}`

const getPlayerName = (player: PlayerRow) =>
  `${player.firstName} ${player.surname}`

export default function PlayersClient({
  players,
  teams,
  createPlayerAction,
  updatePlayerAction,
  archivePlayerAction,
  restorePlayerAction,
}: PlayersClientProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [positionFilter, setPositionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<PlayerSortOption>('nameAsc')
  const activeCount = players.filter((player) => player.isActive).length
  const archivedCount = players.length - activeCount
  const teamFilterOptions = Array.from(
    new Set(players.map((player) => `${player.clubName} / ${player.teamName}`))
  ).sort((a, b) => a.localeCompare(b))
  const positionFilterOptions = Array.from(
    new Set(
      players
        .map((player) => player.preferredPosition)
        .filter((position): position is string => Boolean(position))
    )
  ).sort((a, b) => a.localeCompare(b))
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const filteredPlayers = players.filter((player) => {
    const teamLabel = `${player.clubName} / ${player.teamName}`
    const searchableText = [
      getPlayerName(player),
      player.teamName,
      player.clubName,
      player.preferredPosition ?? '',
      player.squadNumber === null ? '' : String(player.squadNumber),
    ]
      .join(' ')
      .toLowerCase()

    return (
      (!normalizedSearchTerm || searchableText.includes(normalizedSearchTerm)) &&
      (teamFilter === 'all' || teamLabel === teamFilter) &&
      (positionFilter === 'all' || player.preferredPosition === positionFilter) &&
      (statusFilter === 'all' ||
        (statusFilter === 'active' ? player.isActive : !player.isActive))
    )
  })
  const filteredAndSortedPlayers = [...filteredPlayers].sort((a, b) => {
    const firstName = getPlayerName(a)
    const secondName = getPlayerName(b)

    if (sortBy === 'nameDesc') return secondName.localeCompare(firstName)
    if (sortBy === 'teamAsc') {
      return `${a.clubName} / ${a.teamName}`.localeCompare(
        `${b.clubName} / ${b.teamName}`
      )
    }
    if (sortBy === 'positionAsc') {
      return (a.preferredPosition ?? '').localeCompare(b.preferredPosition ?? '')
    }
    if (sortBy === 'squadAsc') {
      return (a.squadNumber ?? Number.MAX_SAFE_INTEGER) -
        (b.squadNumber ?? Number.MAX_SAFE_INTEGER)
    }
    if (sortBy === 'squadDesc') return (b.squadNumber ?? -1) - (a.squadNumber ?? -1)
    if (sortBy === 'activeFirst') return Number(b.isActive) - Number(a.isActive)
    if (sortBy === 'archivedFirst') return Number(a.isActive) - Number(b.isActive)

    return firstName.localeCompare(secondName)
  })
  const hasActiveFilters =
    Boolean(normalizedSearchTerm) ||
    teamFilter !== 'all' ||
    positionFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortBy !== 'nameAsc'

  const clearFilters = () => {
    setSearchTerm('')
    setTeamFilter('all')
    setPositionFilter('all')
    setStatusFilter('all')
    setSortBy('nameAsc')
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedPlayer(null)
    setError(null)
  }

  const openAddModal = () => {
    setSelectedPlayer(null)
    setError(null)
    setModalMode('add')
  }

  const openDetailModal = (player: PlayerRow) => {
    setSelectedPlayer(player)
    setError(null)
    setModalMode('detail')
  }

  const openEditModal = () => {
    setError(null)
    setModalMode('edit')
  }

  const submitAction = async (
    action: PlayerAction,
    formData: FormData,
    nextMode: ModalMode = null
  ) => {
    setIsSubmitting(true)
    setError(null)

    const result = await action(formData)

    if (result.ok) {
      setModalMode(nextMode)
      if (nextMode === null) setSelectedPlayer(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  const archiveOrRestore = async () => {
    if (!selectedPlayer) return

    const formData = new FormData()
    formData.set('id', selectedPlayer.id)

    await submitAction(
      selectedPlayer.isActive ? archivePlayerAction : restorePlayerAction,
      formData
    )
  }

  return (
    <>
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total players" value={players.length} />
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="Archived" value={archivedCount} />
      </section>

      <SectionCard
        title="Player List"
        description="Click a row to view details or edit a player."
        actions={(
          <Button
            type="button"
            onClick={openAddModal}
          >
            Add Player
          </Button>
        )}
        bodyClassName="p-0"
      >

        <div className="border-b border-slate-100 p-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <label className="text-sm font-medium lg:col-span-2">
              Search
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={fieldClassName}
                placeholder="Name, team, position or squad number"
              />
            </label>

            <label className="text-sm font-medium">
              Team
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
                className={fieldClassName}
              >
                <option value="all">All teams</option>
                {teamFilterOptions.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={fieldClassName}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as PlayerSortOption)}
                className={fieldClassName}
              >
                <option value="nameAsc">Name A-Z</option>
                <option value="nameDesc">Name Z-A</option>
                <option value="teamAsc">Team A-Z</option>
                <option value="positionAsc">Position A-Z</option>
                <option value="squadAsc">Squad number ascending</option>
                <option value="squadDesc">Squad number descending</option>
                <option value="activeFirst">Active first</option>
                <option value="archivedFirst">Archived first</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <p>
              Showing {filteredAndSortedPlayers.length} of {players.length} players.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-medium text-gray-700">
                Position
                <select
                  value={positionFilter}
                  onChange={(event) => setPositionFilter(event.target.value)}
                  className="ml-2 rounded border p-2 text-sm font-normal text-gray-900"
                >
                  <option value="all">All</option>
                  {positionFilterOptions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {players.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No players yet.</p>
        ) : filteredAndSortedPlayers.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No players match these filters.
          </p>
        ) : (
          <>
          <div className="divide-y md:hidden">
            {filteredAndSortedPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => openDetailModal(player)}
                className="block w-full p-4 text-left hover:bg-blue-50/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold">{getPlayerName(player)}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {player.clubName} / {player.teamName}
                    </p>
                  </div>
                  <StatusBadge
                    label={player.isActive ? 'Active' : 'Archived'}
                    variant={player.isActive ? 'active' : 'archived'}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Position</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {player.preferredPosition ?? 'Not set'}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Squad number</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {formatSquadNumber(player.squadNumber)}
                    </dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>

          <DataTable className="min-w-[760px]">
              <DataTableHead>
                <tr>
                  <DataTableHeader>Player name</DataTableHeader>
                  <DataTableHeader>Team</DataTableHeader>
                  <DataTableHeader>Position</DataTableHeader>
                  <DataTableHeader>Squad number</DataTableHeader>
                  <DataTableHeader>Status</DataTableHeader>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filteredAndSortedPlayers.map((player) => (
                  <tr
                    key={player.id}
                    onClick={() => openDetailModal(player)}
                    className={dataTableRowClassName(true)}
                  >
                    <DataTableCell className="font-medium text-slate-950">{getPlayerName(player)}</DataTableCell>
                    <DataTableCell>
                      {player.clubName} / {player.teamName}
                    </DataTableCell>
                    <DataTableCell>
                      {player.preferredPosition ?? 'Not set'}
                    </DataTableCell>
                    <DataTableCell>
                      {formatSquadNumber(player.squadNumber)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        label={player.isActive ? 'Active' : 'Archived'}
                        variant={player.isActive ? 'active' : 'archived'}
                      />
                    </DataTableCell>
                  </tr>
                ))}
              </DataTableBody>
          </DataTable>
          </>
        )}
      </SectionCard>

      {modalMode && (
        <ModalShell
          title={modalMode === 'add'
            ? 'Add Player'
            : modalMode === 'edit'
              ? 'Edit Player'
              : selectedPlayer
                ? getPlayerName(selectedPlayer)
                : 'Player Details'}
          description={modalMode === 'detail'
            ? 'View player details and manage status.'
            : 'Squad number, date of birth and joined date are optional.'}
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode={modalMode === 'add' ? 'create' : modalMode === 'edit' ? 'edit' : 'detail'}
        >
            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            {modalMode === 'add' && (
              <PlayerForm
                teams={teams}
                action={createPlayerAction}
                submitLabel="Create Player"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'edit' && selectedPlayer && (
              <PlayerForm
                teams={teams}
                player={selectedPlayer}
                action={updatePlayerAction}
                submitLabel="Save Player"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'detail' && selectedPlayer && (
              <PlayerDetail
                player={selectedPlayer}
                isSubmitting={isSubmitting}
                onEdit={openEditModal}
                onArchiveOrRestore={archiveOrRestore}
              />
            )}
        </ModalShell>
      )}
    </>
  )
}

function PlayerForm({
  teams,
  player,
  action,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  teams: TeamOption[]
  player?: PlayerRow
  action: PlayerAction
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (action: PlayerAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className={formGridClassName}>
      {player && <input type="hidden" name="id" value={player.id} />}

      <FormField label="Team" className="md:col-span-2">
        <select
          name="teamId"
          required
          defaultValue={player?.teamId ?? teams[0]?.id}
          className={fieldClassName}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.clubName} - {team.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="First name">
        <input
          name="firstName"
          required
          defaultValue={player?.firstName ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Surname">
        <input
          name="surname"
          required
          defaultValue={player?.surname ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Squad number optional">
        <input
          name="squadNumber"
          type="number"
          min="0"
          defaultValue={player?.squadNumber ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Preferred position">
        <select
          name="preferredPosition"
          required
          defaultValue={player?.preferredPosition ?? ''}
          className={fieldClassName}
        >
          <option value="" disabled>
            Select position
          </option>
          {playerPositions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Date of birth">
        <input
          name="dateOfBirth"
          type="date"
          defaultValue={player?.dateOfBirthInput ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Joined club date">
        <input
          name="joinedClubDate"
          type="date"
          defaultValue={player?.joinedClubDateInput ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <div className="flex items-end md:col-span-2">
        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function PlayerDetail({
  player,
  isSubmitting,
  onEdit,
  onArchiveOrRestore,
}: {
  player: PlayerRow
  isSubmitting: boolean
  onEdit: () => void
  onArchiveOrRestore: () => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Team" value={`${player.clubName} / ${player.teamName}`} />
        <DetailItem label="Position" value={player.preferredPosition ?? 'Not set'} />
        <DetailItem label="Squad number" value={formatSquadNumber(player.squadNumber)} />
        <DetailItem label="Status" value={player.isActive ? 'Active' : 'Archived'} />
        <DetailItem label="Date of birth" value={player.dateOfBirthDisplay} />
        <DetailItem label="Joined club" value={player.joinedClubDateDisplay} />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          onClick={onEdit}
          disabled={isSubmitting}
        >
          Edit Player
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Player status admin
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Archive or restore this player outside normal squad edits.
        </p>
        <Button
          type="button"
          onClick={onArchiveOrRestore}
          variant="secondary"
          className={`mt-3 ${player.isActive ? 'text-red-700' : 'text-blue-700'}`}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Saving...'
            : player.isActive
              ? 'Archive Player'
              : 'Restore Player'}
        </Button>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  )
}
