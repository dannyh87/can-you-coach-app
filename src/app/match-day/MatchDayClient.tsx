'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import ActionLink from '@/components/ui/ActionLink'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
} from '@/components/ui/DataTable'
import FormField from '@/components/ui/FormField'
import ModalShell from '@/components/ui/ModalShell'
import SectionCard from '@/components/ui/SectionCard'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type TeamOption = {
  id: string
  name: string
  clubName: string
}

type MatchDayRow = {
  id: string
  dateDisplay: string
  kickoffTimeDisplay: string
  opposition: string
  teamName: string
  clubName: string
  matchTypeLabel: string
  venueLabel: string
  ownScore: number
  oppositionScore: number
  statusLabel: string
  statusClasses: string
}

type MatchDayClientProps = {
  teams: TeamOption[]
  matches: MatchDayRow[]
  createMatchDayAction: (formData: FormData) => Promise<MatchActionResult>
}

type ModalMode = 'create' | 'detail' | null

export default function MatchDayClient({
  teams,
  matches,
  createMatchDayAction,
}: MatchDayClientProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedMatch, setSelectedMatch] = useState<MatchDayRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedMatch(null)
    setError(null)
  }

  const openDetailModal = (match: MatchDayRow) => {
    setSelectedMatch(match)
    setError(null)
    setModalMode('detail')
  }

  const createMatch = async (formData: FormData) => {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const result = await createMatchDayAction(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedMatch(null)
      setMessage('Match created.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  return (
    <>
      {message && (
        <Alert variant="success" className="mb-6">{message}</Alert>
      )}

      <SectionCard
        title="Matches"
        description="Review created match records and open details."
        actions={(
          <ActionLink href="/match-day/new" variant="primary">
            Create Match Day
          </ActionLink>
        )}
        bodyClassName="p-0"
      >

        {matches.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No matches created yet.</p>
        ) : (
          <>
          <div className="divide-y md:hidden">
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => openDetailModal(match)}
                className="block w-full p-4 text-left hover:bg-blue-50/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">{match.opposition}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {match.dateDisplay} · {match.kickoffTimeDisplay}
                    </p>
                  </div>
                  <StatusBadge label={match.statusLabel} variant={getStatusBadgeVariant(match.statusLabel.toUpperCase().replace(' ', '_'))} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Team</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {match.clubName} / {match.teamName}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Score</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {match.ownScore}-{match.oppositionScore}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Type</dt>
                    <dd className="mt-1 font-semibold text-gray-900">{match.matchTypeLabel}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-gray-500">Venue</dt>
                    <dd className="mt-1 font-semibold text-gray-900">{match.venueLabel}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm font-semibold text-blue-700">Tap to view actions</p>
              </button>
            ))}
          </div>

          <DataTable className="min-w-[900px]">
              <DataTableHead>
                <tr>
                  <DataTableHeader>Date</DataTableHeader>
                  <DataTableHeader>Opposition</DataTableHeader>
                  <DataTableHeader>Team</DataTableHeader>
                  <DataTableHeader>Match type</DataTableHeader>
                  <DataTableHeader>Venue</DataTableHeader>
                  <DataTableHeader>Score</DataTableHeader>
                  <DataTableHeader>Status</DataTableHeader>
                  <DataTableHeader>Action</DataTableHeader>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {matches.map((match) => (
                  <tr
                    key={match.id}
                    onClick={() => openDetailModal(match)}
                    className="cursor-pointer hover:bg-blue-50/70"
                  >
                    <DataTableCell>
                      {match.dateDisplay} · {match.kickoffTimeDisplay}
                    </DataTableCell>
                    <DataTableCell className="font-medium text-slate-950">{match.opposition}</DataTableCell>
                    <DataTableCell>
                      {match.clubName} / {match.teamName}
                    </DataTableCell>
                    <DataTableCell>{match.matchTypeLabel}</DataTableCell>
                    <DataTableCell>{match.venueLabel}</DataTableCell>
                    <DataTableCell className="font-medium text-slate-950">
                      {match.ownScore}-{match.oppositionScore}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge label={match.statusLabel} variant={getStatusBadgeVariant(match.statusLabel.toUpperCase().replace(' ', '_'))} />
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-sm font-semibold text-blue-700">View details</span>
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
          title={modalMode === 'create' ? 'Create match' : selectedMatch?.opposition ?? 'Match details'}
          description={modalMode === 'create'
            ? 'Set up the match record before choosing squad and events.'
            : 'Review match details before opening the live match workspace.'}
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode={modalMode === 'create' ? 'create' : 'detail'}
        >
            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            {modalMode === 'create' && (
              <CreateMatchForm
                teams={teams}
                isSubmitting={isSubmitting}
                onSubmit={createMatch}
              />
            )}

            {modalMode === 'detail' && selectedMatch && (
              <MatchDetail match={selectedMatch} />
            )}
        </ModalShell>
      )}
    </>
  )
}

function MatchDetail({ match }: { match: MatchDayRow }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Opposition" value={match.opposition} />
        <DetailItem label="Team" value={`${match.clubName} / ${match.teamName}`} />
        <DetailItem label="Date" value={`${match.dateDisplay} · ${match.kickoffTimeDisplay}`} />
        <DetailItem label="Type" value={match.matchTypeLabel} />
        <DetailItem label="Venue" value={match.venueLabel} />
        <DetailItem label="Score" value={`${match.ownScore}-${match.oppositionScore}`} />
      </div>
      <div className="rounded-lg border p-4">
        <dt className="text-sm text-gray-500">Status</dt>
        <dd className="mt-2">
          <StatusBadge label={match.statusLabel} variant={getStatusBadgeVariant(match.statusLabel)} />
        </dd>
      </div>
      <ActionLink href={`/match-day/${match.id}`} variant="primary">
        Open match
      </ActionLink>
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

function CreateMatchForm({
  teams,
  isSubmitting,
  onSubmit,
}: {
  teams: TeamOption[]
  isSubmitting: boolean
  onSubmit: (formData: FormData) => Promise<void>
}) {
  return (
    <form action={onSubmit} className={formGridClassName}>
      <FormField label="Team">
        <select
          name="teamId"
          required
          defaultValue={teams[0]?.id}
          className={fieldClassName}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.clubName} - {team.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Opposition">
        <input
          name="opposition"
          required
          className={fieldClassName}
          placeholder="e.g. Brereton Social"
        />
      </FormField>

      <FormField label="Date">
        <input
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Kick-off time">
        <input
          name="kickoffTime"
          type="time"
          required
          defaultValue="10:30"
          className={fieldClassName}
        />
      </FormField>

      <FormField label="Match type">
        <select
          name="matchType"
          required
          defaultValue="LEAGUE"
          className={fieldClassName}
        >
          <option value="LEAGUE">League</option>
          <option value="CUP">Cup</option>
          <option value="FRIENDLY">Friendly</option>
        </select>
      </FormField>

      <FormField label="Venue">
        <select
          name="venue"
          required
          defaultValue="HOME"
          className={fieldClassName}
        >
          <option value="HOME">Home</option>
          <option value="AWAY">Away</option>
          <option value="NEUTRAL">Neutral</option>
        </select>
      </FormField>

      <div className="flex items-end md:col-span-2">
        <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create match'}
        </Button>
      </div>
    </form>
  )
}
