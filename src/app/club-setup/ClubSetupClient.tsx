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
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'

type SetupActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type SetupAction = (formData: FormData) => Promise<SetupActionResult>

type TeamRow = {
  id: string
  clubId: string
  clubName: string
  name: string
  ageGroup: string
  season: string
  league: string | null
  footballPyramidStep: string | null
  playerCount: number
  fitnessSessionCount: number
}

type ClubRow = {
  id: string
  name: string
  location: string | null
  notes: string | null
  teams: TeamRow[]
}

type ModalMode = 'editClub' | 'addTeam' | 'teamDetail' | 'editTeam' | 'deleteTeam' | null

type ClubSetupClientProps = {
  clubs: ClubRow[]
  updateClubAction: SetupAction
  createTeamAction: SetupAction
  updateTeamAction: SetupAction
  deleteTeamAction: SetupAction
}

const footballPyramidStepOptions = [
  'Step 1',
  'Step 2',
  'Step 3',
  'Step 4',
  'Step 5',
  'Step 6',
  'Step 7 and below',
  'Sunday League',
]

export default function ClubSetupClient({
  clubs,
  updateClubAction,
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
}: ClubSetupClientProps) {
  const router = useRouter()
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id ?? '')
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedClub =
    clubs.find((club) => club.id === selectedClubId) ?? clubs[0] ?? null
  const teams = selectedClub?.teams ?? []
  const totalPlayers = teams.reduce((total, team) => total + team.playerCount, 0)
  const totalFitnessSessions = teams.reduce(
    (total, team) => total + team.fitnessSessionCount,
    0
  )

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedTeam(null)
    setError(null)
  }

  const openModal = (mode: ModalMode, team: TeamRow | null = null) => {
    setSelectedTeam(team)
    setError(null)
    setModalMode(mode)
  }

  const returnToTeamDetail = () => {
    if (isSubmitting) return
    setError(null)
    setModalMode('teamDetail')
  }

  const submitAction = async (action: SetupAction, formData: FormData) => {
    setIsSubmitting(true)
    setError(null)

    const result = await action(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedTeam(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  const deleteSelectedTeam = async () => {
    if (!selectedTeam) return

    const formData = new FormData()
    formData.set('id', selectedTeam.id)

    await submitAction(deleteTeamAction, formData)
  }

  if (!selectedClub) {
    return (
      <section className="rounded-lg border p-4">
        <h2 className="text-xl font-bold">No club found</h2>
        <p className="mt-2 text-sm text-gray-500">
          A default club could not be loaded. Try refreshing the page.
        </p>
      </section>
    )
  }

  return (
    <>
      {clubs.length > 1 && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-medium">
            Current club
            <select
              value={selectedClub.id}
              onChange={(event) => {
                setSelectedClubId(event.target.value)
                setSelectedTeam(null)
                setError(null)
                setModalMode(null)
              }}
              className={fieldClassName}
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <SectionCard
        className="mb-6"
        title={selectedClub.name}
        description={selectedClub.location || 'No location set'}
        actions={(
          <Button
            type="button"
            onClick={() => openModal('editClub')}
            size="sm"
          >
            Edit Club
          </Button>
        )}
      >

        {selectedClub.notes && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {selectedClub.notes}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Teams" value={teams.length} />
          <StatCard label="Players" value={totalPlayers} />
          <StatCard label="Fitness sessions" value={totalFitnessSessions} />
        </div>
      </SectionCard>

      <SectionCard
        title="Teams"
        description={`Teams belonging to ${selectedClub.name}.`}
        actions={(
          <Button
            type="button"
            onClick={() => openModal('addTeam')}
            size="sm"
          >
            Add Team
          </Button>
        )}
        bodyClassName="p-0"
      >

        {teams.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No teams created for this club yet.</p>
        ) : (
          <>
          <div className="divide-y md:hidden">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => openModal('teamDetail', team)}
                className="block w-full p-4 text-left hover:bg-blue-50/70"
              >
                <div>
                  <p className="text-base font-bold">{team.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {team.ageGroup} · {team.season}
                  </p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Players</dt>
                    <dd className="mt-1 font-semibold text-gray-900">{team.playerCount}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Fitness sessions</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {team.fitnessSessionCount}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">League</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {team.league || 'Not set'}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Level</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {team.footballPyramidStep || 'Not set'}
                    </dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>

          <DataTable className="min-w-[960px]">
              <DataTableHead>
                <tr>
                  <DataTableHeader>Team name</DataTableHeader>
                  <DataTableHeader>Age group</DataTableHeader>
                  <DataTableHeader>Season</DataTableHeader>
                  <DataTableHeader>League</DataTableHeader>
                  <DataTableHeader>Level</DataTableHeader>
                  <DataTableHeader>Players</DataTableHeader>
                  <DataTableHeader>Fitness sessions</DataTableHeader>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    onClick={() => openModal('teamDetail', team)}
                    className={dataTableRowClassName(true)}
                  >
                    <DataTableCell className="font-medium text-slate-950">{team.name}</DataTableCell>
                    <DataTableCell>{team.ageGroup}</DataTableCell>
                    <DataTableCell>{team.season}</DataTableCell>
                    <DataTableCell>
                      {team.league || 'Not set'}
                    </DataTableCell>
                    <DataTableCell>
                      {team.footballPyramidStep || 'Not set'}
                    </DataTableCell>
                    <DataTableCell>{team.playerCount}</DataTableCell>
                    <DataTableCell>
                      {team.fitnessSessionCount}
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
          title={modalMode === 'editClub'
            ? 'Edit Club'
            : modalMode === 'addTeam'
              ? 'Add Team'
              : modalMode === 'editTeam'
                ? 'Edit Team'
                : modalMode === 'deleteTeam'
                  ? 'Confirm Delete Team'
                  : selectedTeam?.name ?? 'Team Details'}
          description={modalMode === 'deleteTeam'
            ? 'Deletion is permanent and only allowed for empty teams.'
            : modalMode === 'teamDetail'
              ? 'View team details and manage this team.'
              : 'Changes are saved only after a successful action.'}
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode={modalMode === 'deleteTeam' ? 'danger' : modalMode === 'teamDetail' ? 'detail' : modalMode === 'editClub' || modalMode === 'editTeam' ? 'edit' : 'create'}
        >
            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            {modalMode === 'editClub' && (
              <ClubForm
                club={selectedClub}
                action={updateClubAction}
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'addTeam' && (
              <TeamForm
                club={selectedClub}
                action={createTeamAction}
                submitLabel="Create Team"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'editTeam' && selectedTeam && (
              <TeamForm
                club={selectedClub}
                team={selectedTeam}
                action={updateTeamAction}
                submitLabel="Save Team"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'teamDetail' && selectedTeam && (
              <TeamDetail
                team={selectedTeam}
                isSubmitting={isSubmitting}
                onEdit={() => openModal('editTeam', selectedTeam)}
                onDelete={() => openModal('deleteTeam', selectedTeam)}
              />
            )}

            {modalMode === 'deleteTeam' && selectedTeam && (
              <DeleteTeamConfirmation
                team={selectedTeam}
                isSubmitting={isSubmitting}
                onCancel={returnToTeamDetail}
                onConfirm={deleteSelectedTeam}
              />
            )}
        </ModalShell>
      )}
    </>
  )
}

function ClubForm({
  club,
  action,
  isSubmitting,
  onSubmit,
}: {
  club: ClubRow
  action: SetupAction
  isSubmitting: boolean
  onSubmit: (action: SetupAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className="grid gap-3">
      <input type="hidden" name="id" value={club.id} />

      <FormField label="Club name">
        <input
          name="name"
          required
          defaultValue={club.name}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Location">
        <input
          name="location"
          defaultValue={club.location ?? ''}
          className={fieldClassName}
          placeholder="Optional"
        />
      </FormField>

      <FormField label="Notes">
        <textarea
          name="notes"
          defaultValue={club.notes ?? ''}
          className={fieldClassName}
          rows={3}
          placeholder="Optional"
        />
      </FormField>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Club'}
      </Button>
    </form>
  )
}

function TeamForm({
  club,
  team,
  action,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  club: ClubRow
  team?: TeamRow
  action: SetupAction
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (action: SetupAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className={formGridClassName}>
      {team && <input type="hidden" name="id" value={team.id} />}
      <input type="hidden" name="clubId" value={club.id} />

      <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 md:col-span-2">
        Club: <span className="font-medium text-gray-900">{club.name}</span>
      </div>

      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 md:col-span-2">
        League and level are optional now, but will support future benchmarking.
        Use the step dropdown for Open Age teams where pyramid level matters.
      </p>

      <FormField label="Team name">
        <input
          name="name"
          required
          defaultValue={team?.name ?? ''}
          className={fieldClassName}
          placeholder="e.g. First Team"
        />
      </FormField>

      <FormField label="Age group">
        <input
          name="ageGroup"
          required
          defaultValue={team?.ageGroup ?? ''}
          className={fieldClassName}
          placeholder="e.g. Open Age"
        />
      </FormField>

      <FormField label="Season">
        <input
          name="season"
          required
          defaultValue={team?.season ?? ''}
          className={fieldClassName}
          placeholder="e.g. 2026/27"
        />
      </FormField>

      <FormField label="League">
        <input
          name="league"
          defaultValue={team?.league ?? ''}
          className={fieldClassName}
          placeholder="e.g. North West Counties League"
        />
      </FormField>

      <FormField label="Football pyramid step">
        <select
          name="footballPyramidStep"
          defaultValue={team?.footballPyramidStep ?? ''}
          className={fieldClassName}
        >
          <option value="">Not set</option>
          {footballPyramidStepOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormField>

      <div className="flex items-end md:col-span-2">
        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function TeamDetail({
  team,
  isSubmitting,
  onEdit,
  onDelete,
}: {
  team: TeamRow
  isSubmitting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Club" value={team.clubName} />
        <DetailItem label="Age group" value={team.ageGroup} />
        <DetailItem label="Season" value={team.season} />
        <DetailItem label="League" value={team.league || 'Not set'} />
        <DetailItem
          label="Football pyramid step"
          value={team.footballPyramidStep || 'Not set'}
        />
        <DetailItem label="Players" value={String(team.playerCount)} />
        <DetailItem
          label="Fitness sessions"
          value={String(team.fitnessSessionCount)}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          onClick={onEdit}
          disabled={isSubmitting}
        >
          Edit Team
        </Button>
      </div>

      <div className="rounded-lg border border-red-100 bg-red-50 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-red-700">
          Danger zone
        </h3>
        <p className="mt-1 text-sm text-red-700">
          Delete is permanent and only available when the team has no linked records.
        </p>
        <Button
          type="button"
          onClick={onDelete}
          variant="secondary"
          className="mt-3 border-red-200 text-red-700"
          disabled={isSubmitting}
        >
          Delete Team
        </Button>
      </div>
    </div>
  )
}

function DeleteTeamConfirmation({
  team,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  team: TeamRow
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const isBlocked = team.playerCount > 0 || team.fitnessSessionCount > 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-bold">{team.name}</h3>
        <p className="mt-1 text-sm text-gray-500">{team.clubName}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailItem label="Players" value={String(team.playerCount)} />
          <DetailItem
            label="Fitness sessions"
            value={String(team.fitnessSessionCount)}
          />
        </dl>
      </div>

      {isBlocked ? (
        <Alert variant="warning">
          This team cannot be deleted while it has players or fitness sessions.
          Move or remove them before deleting this team.
        </Alert>
      ) : (
        <Alert variant="error">
          This will permanently delete the team. This action cannot be undone.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        {!isBlocked && (
          <Button
            type="button"
            onClick={onConfirm}
            variant="danger"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting...' : 'Confirm Delete Team'}
          </Button>
        )}
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
