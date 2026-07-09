'use client'

import { useMemo, useState, useTransition } from 'react'

import FitnessTestGuidance from '@/components/FitnessTestGuidance'
import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/formStyles'
import { WizardActions, WizardOptionCard, WizardShell } from '@/components/ui/Wizard'

type TeamOption = {
  id: string
  name: string
  clubName: string
  players: Array<{
    id: string
    name: string
    squadNumber: number | null
    preferredPosition: string | null
  }>
}

type FitnessTestTypeOption = {
  id: string
  name: string
  resultUnit: string
  recordingModeLabel: string
  preferredMode: string
  preferredModeLabel: string
  setupInstructions: string | null
  equipmentNeeded: string | null
  scoringNotes: string | null
  spaceRequired: string | null
  coachNotes: string | null
  videoUrl: string | null
  targetScores: string | null
}

type WizardResult = { ok: false; reason: string } | void

const today = () => new Date().toISOString().split('T')[0]

export default function FitnessSessionWizard({
  teams,
  fitnessTestTypes,
  createAction,
}: {
  teams: TeamOption[]
  fitnessTestTypes: FitnessTestTypeOption[]
  createAction: (formData: FormData) => Promise<WizardResult>
}) {
  const [step, setStep] = useState(1)
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [fitnessTestTypeId, setFitnessTestTypeId] = useState(fitnessTestTypes[0]?.id ?? '')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [unavailablePlayerIds, setUnavailablePlayerIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0]
  const selectedTestType = fitnessTestTypes.find((testType) => testType.id === fitnessTestTypeId) ?? fitnessTestTypes[0]
  const availableCount = Math.max(0, (selectedTeam?.players.length ?? 0) - unavailablePlayerIds.length)
  const totalSteps = 6

  const unavailableSet = useMemo(() => new Set(unavailablePlayerIds), [unavailablePlayerIds])

  const goNext = () => setStep((currentStep) => Math.min(totalSteps, currentStep + 1))
  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1))
  const toggleUnavailable = (playerId: string) => {
    setUnavailablePlayerIds((currentIds) =>
      currentIds.includes(playerId)
        ? currentIds.filter((id) => id !== playerId)
        : [...currentIds, playerId]
    )
  }

  const createSession = () => {
    setError(null)
    const formData = new FormData()
    formData.set('teamId', teamId)
    formData.set('fitnessTestTypeId', fitnessTestTypeId)
    formData.set('date', date)
    formData.set('notes', notes)
    unavailablePlayerIds.forEach((playerId) => formData.append('unavailablePlayerId', playerId))

    startTransition(async () => {
      const result = await createAction(formData)
      if (result && !result.ok) setError(result.reason)
    })
  }

  if (teams.length === 0 || fitnessTestTypes.length === 0) {
    return <p className="rounded-xl border p-4 text-sm text-slate-600">Teams and fitness test types are required before creating a test.</p>
  }

  return (
    <WizardShell
      currentStep={step}
      totalSteps={totalSteps}
      title={getStepTitle(step)}
      description={getStepDescription(step)}
    >
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {step === 1 && (
        <div className="grid gap-3">
          {teams.map((team) => (
            <WizardOptionCard
              key={team.id}
              title={team.name}
              description={team.clubName}
              meta={`${team.players.length} active players`}
              selected={team.id === teamId}
              onClick={() => {
                setTeamId(team.id)
                setUnavailablePlayerIds([])
              }}
            />
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          {fitnessTestTypes.map((testType) => (
            <WizardOptionCard
              key={testType.id}
              title={testType.name}
              description={`Unit: ${testType.resultUnit}`}
              meta={`Preferred: ${testType.preferredModeLabel} · Allowed: ${testType.recordingModeLabel}`}
              selected={testType.id === fitnessTestTypeId}
              onClick={() => setFitnessTestTypeId(testType.id)}
            />
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4">
          <label className="text-sm font-semibold text-slate-700">
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClassName} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Notes optional
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className={fieldClassName} placeholder="Anything useful for this test" />
          </label>
        </div>
      )}

      {step === 4 && selectedTeam && (
        <div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
            <span className="rounded-full bg-green-100 px-3 py-1">Available {availableCount}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1">Absent / Unavailable {unavailablePlayerIds.length}</span>
          </div>
          <div className="grid gap-2">
            {selectedTeam.players.map((player) => {
              const isUnavailable = unavailableSet.has(player.id)
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggleUnavailable(player.id)}
                  className={`rounded-xl border p-3 text-left ${isUnavailable ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{player.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {player.squadNumber === null ? 'No squad number' : `#${player.squadNumber}`} · {player.preferredPosition ?? 'No position'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isUnavailable ? 'bg-amber-200 text-amber-900' : 'bg-green-100 text-green-800'}`}>
                      {isUnavailable ? 'Absent / Unavailable' : 'Available'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 5 && selectedTestType && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h2 className="text-lg font-bold text-blue-950">{selectedTestType.name}</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Preferred mode" value={selectedTestType.preferredModeLabel} />
            <Detail label="Allowed modes" value={selectedTestType.recordingModeLabel} />
          </dl>
          <p className="mt-3 text-sm text-blue-900">The test will open in the preferred supported recording mode. Unsupported modes are not available.</p>
          <FitnessTestGuidance
            guidance={selectedTestType}
            title="Test setup"
            description="Use this as a quick pitch-side check before you create the session."
            compact
            className="mt-4"
          />
        </div>
      )}

      {step === 6 && selectedTeam && selectedTestType && (
        <div className="space-y-3">
          <ReviewRow label="Team" value={`${selectedTeam.clubName} / ${selectedTeam.name}`} />
          <ReviewRow label="Test" value={selectedTestType.name} />
          <ReviewRow label="Date" value={date} />
          <ReviewRow label="Players" value={`${availableCount} available, ${unavailablePlayerIds.length} absent / unavailable`} />
          <ReviewRow label="Recording" value={selectedTestType.preferredModeLabel} />
        </div>
      )}

      <WizardActions>
        <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1 || isPending}>Back</Button>
        <div className="ml-auto flex gap-2">
          {step === 4 && <Button type="button" variant="ghost" onClick={goNext}>Skip</Button>}
          {step < totalSteps ? (
            <Button type="button" onClick={goNext}>Next</Button>
          ) : (
            <Button type="button" onClick={createSession} disabled={isPending}>{isPending ? 'Creating...' : 'Create Test'}</Button>
          )}
        </div>
      </WizardActions>
    </WizardShell>
  )
}

function getStepTitle(step: number) {
  if (step === 1) return 'Choose team'
  if (step === 2) return 'Choose test type'
  if (step === 3) return 'Date and notes'
  if (step === 4) return 'Who is available?'
  if (step === 5) return 'Confirm recording mode'
  return 'Review and create'
}

function getStepDescription(step: number) {
  if (step === 4) return 'Everyone is available by default. Mark injured or unavailable players as absent.'
  if (step === 5) return 'Recording modes come from the Fitness Test Library.'
  if (step === 6) return 'Check the setup before creating the session.'
  return undefined
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <dt className="font-semibold text-blue-700">{label}</dt>
      <dd className="mt-1 font-bold text-blue-950">{value}</dd>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="text-right font-bold text-slate-950">{value}</dd>
    </div>
  )
}
