'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
        <p className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      <section className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-xl font-bold">Matches</h2>
            <p className="mt-1 text-sm text-gray-500">
              Review created match records and open details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setMessage(null)
              setIsCreateModalOpen(true)
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Create match
          </button>
        </div>

        {matches.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No matches created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Opposition</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Match type</th>
                  <th className="px-4 py-3 font-medium">Venue</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td className="px-4 py-3 text-gray-600">
                      {match.dateDisplay} · {match.kickoffTimeDisplay}
                    </td>
                    <td className="px-4 py-3 font-medium">{match.opposition}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {match.clubName} / {match.teamName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{match.matchTypeLabel}</td>
                    <td className="px-4 py-3 text-gray-600">{match.venueLabel}</td>
                    <td className="px-4 py-3 font-medium">
                      {match.ownScore}-{match.oppositionScore}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${match.statusClasses}`}>
                        {match.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/match-day/${match.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Create match</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Set up the match record. Squad, timer and events come later.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded border px-3 py-1 text-sm font-medium"
                disabled={isSubmitting}
              >
                Close
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <CreateMatchForm
              teams={teams}
              isSubmitting={isSubmitting}
              onSubmit={createMatch}
            />
          </div>
        </div>
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
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">
        Team
        <select
          name="teamId"
          required
          defaultValue={teams[0]?.id}
          className="mt-1 w-full rounded border p-2"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.clubName} - {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Opposition
        <input
          name="opposition"
          required
          className="mt-1 w-full rounded border p-2"
          placeholder="e.g. Brereton Social"
        />
      </label>

      <label className="text-sm font-medium">
        Date
        <input
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Kick-off time
        <input
          name="kickoffTime"
          type="time"
          required
          defaultValue="10:30"
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Match type
        <select
          name="matchType"
          required
          defaultValue="LEAGUE"
          className="mt-1 w-full rounded border p-2"
        >
          <option value="LEAGUE">League</option>
          <option value="CUP">Cup</option>
          <option value="FRIENDLY">Friendly</option>
        </select>
      </label>

      <label className="text-sm font-medium">
        Venue
        <select
          name="venue"
          required
          defaultValue="HOME"
          className="mt-1 w-full rounded border p-2"
        >
          <option value="HOME">Home</option>
          <option value="AWAY">Away</option>
          <option value="NEUTRAL">Neutral</option>
        </select>
      </label>

      <div className="flex items-end md:col-span-2">
        <button
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create match'}
        </button>
      </div>
    </form>
  )
}
