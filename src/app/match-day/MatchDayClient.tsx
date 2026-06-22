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

export default function MatchDayClient({
  teams,
  matches,
  createMatchDayAction,
}: MatchDayClientProps) {
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const closeModal = () => {
    if (isSubmitting) return
    setIsCreateModalOpen(false)
    setError(null)
  }

  const createMatch = async (formData: FormData) => {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const result = await createMatchDayAction(formData)

    if (result.ok) {
      setIsCreateModalOpen(false)
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
          <Button
            type="button"
            onClick={() => {
              setError(null)
              setMessage(null)
              setIsCreateModalOpen(true)
            }}
          >
            Create match
          </Button>
        )}
        bodyClassName="p-0"
      >

        {matches.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No matches created yet.</p>
        ) : (
          <>
          <div className="divide-y md:hidden">
            {matches.map((match) => (
              <article key={match.id} className="p-4">
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
                <ActionLink
                  href={`/match-day/${match.id}`}
                  variant="primary"
                  fullWidth
                  className="mt-4"
                >
                  Open match
                </ActionLink>
              </article>
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
                  <tr key={match.id}>
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
                      <ActionLink
                        href={`/match-day/${match.id}`}
                        variant="ghost"
                        size="sm"
                      >
                        View details
                      </ActionLink>
                    </DataTableCell>
                  </tr>
                ))}
              </DataTableBody>
          </DataTable>
          </>
        )}
      </SectionCard>

      {isCreateModalOpen && (
        <ModalShell
          title="Create match"
          description="Set up the match record before choosing squad and events."
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode="create"
        >
            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            <CreateMatchForm
              teams={teams}
              isSubmitting={isSubmitting}
              onSubmit={createMatch}
            />
        </ModalShell>
      )}
    </>
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
