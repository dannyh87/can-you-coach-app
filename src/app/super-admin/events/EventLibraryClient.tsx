'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type Option<T extends string = string> = {
  value: T
  label: string
}

type EventDefinition = {
  id: string
  legacyEventType: string | null
  name: string
  description: string | null
  matchPhase: string
  category: string
  agePhases: string[]
  fourCorner: string
  positionRelevance: string[]
  enabledByDefault: boolean
  benchmarkable: boolean
  isActive: boolean
  archivedAt: string | null
}

type EventLibraryClientProps = {
  eventDefinitions: EventDefinition[]
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
  createEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  updateEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  archiveEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  restoreEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
}

const getOptionLabel = (options: readonly Option[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value

const formatList = (options: readonly Option[], values: string[]) =>
  values.map((value) => getOptionLabel(options, value)).join(', ')

export default function EventLibraryClient({
  eventDefinitions,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
  createEventDefinitionAction,
  updateEventDefinitionAction,
  archiveEventDefinitionAction,
  restoreEventDefinitionAction,
}: EventLibraryClientProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeEvents = eventDefinitions.filter((eventDefinition) => eventDefinition.isActive)
  const archivedEvents = eventDefinitions.filter((eventDefinition) => !eventDefinition.isActive)
  const recordableCount = eventDefinitions.filter((eventDefinition) => eventDefinition.legacyEventType).length

  const runFormAction = async ({
    form,
    action,
    pendingLabel,
    successMessage,
    resetOnSuccess = false,
  }: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => {
    if (pendingAction) return

    setPendingAction(pendingLabel)
    setMessage(null)
    setError(null)

    const result = await action(new FormData(form))

    if (result.ok) {
      setMessage(successMessage)
      if (resetOnSuccess) form.reset()
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Super Admin</p>
        <h1 className="mt-1 text-3xl font-bold">Match Day Event Library</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Manage the official global event language. Existing enum-backed events remain the only events recordable in live Match Day for now.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Official events" value={String(eventDefinitions.length)} />
        <SummaryCard label="Recordable now" value={String(recordableCount)} />
        <SummaryCard label="Archived" value={String(archivedEvents.length)} />
      </div>

      {message && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <details className="mt-6 rounded-2xl bg-gray-50 p-4 shadow-sm" open>
        <summary className="cursor-pointer text-lg font-bold">Create official event</summary>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            runFormAction({
              form: event.currentTarget,
              action: createEventDefinitionAction,
              pendingLabel: 'create',
              successMessage: 'Official event created.',
              resetOnSuccess: true,
            })
          }}
        >
          <EventDefinitionFields
            matchPhaseOptions={matchPhaseOptions}
            categoryOptions={categoryOptions}
            agePhaseOptions={agePhaseOptions}
            fourCornerOptions={fourCornerOptions}
            positionOptions={positionOptions}
          />
          <button
            type="submit"
            className="mt-4 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={Boolean(pendingAction)}
          >
            {pendingAction === 'create' ? 'Creating...' : 'Create official event'}
          </button>
        </form>
      </details>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Active official events</h2>
            <p className="mt-1 text-sm text-gray-500">
              Library-only events are stored centrally but are not available in live recording yet.
            </p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
            {activeEvents.length} active
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {activeEvents.map((eventDefinition) => (
            <EventDefinitionCard
              key={eventDefinition.id}
              eventDefinition={eventDefinition}
              matchPhaseOptions={matchPhaseOptions}
              categoryOptions={categoryOptions}
              agePhaseOptions={agePhaseOptions}
              fourCornerOptions={fourCornerOptions}
              positionOptions={positionOptions}
              pendingAction={pendingAction}
              runFormAction={runFormAction}
              updateEventDefinitionAction={updateEventDefinitionAction}
              archiveEventDefinitionAction={archiveEventDefinitionAction}
              restoreEventDefinitionAction={restoreEventDefinitionAction}
            />
          ))}
        </div>
      </section>

      <details className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-lg font-bold">
          Archived events ({archivedEvents.length})
        </summary>
        <div className="mt-4 space-y-3">
          {archivedEvents.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-gray-500">No archived events.</p>
          ) : archivedEvents.map((eventDefinition) => (
            <EventDefinitionCard
              key={eventDefinition.id}
              eventDefinition={eventDefinition}
              matchPhaseOptions={matchPhaseOptions}
              categoryOptions={categoryOptions}
              agePhaseOptions={agePhaseOptions}
              fourCornerOptions={fourCornerOptions}
              positionOptions={positionOptions}
              pendingAction={pendingAction}
              runFormAction={runFormAction}
              updateEventDefinitionAction={updateEventDefinitionAction}
              archiveEventDefinitionAction={archiveEventDefinitionAction}
              restoreEventDefinitionAction={restoreEventDefinitionAction}
            />
          ))}
        </div>
      </details>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function EventDefinitionCard({
  eventDefinition,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
  pendingAction,
  runFormAction,
  updateEventDefinitionAction,
  archiveEventDefinitionAction,
  restoreEventDefinitionAction,
}: {
  eventDefinition: EventDefinition
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
  pendingAction: string | null
  runFormAction: (options: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => Promise<void>
  updateEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  archiveEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  restoreEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
}) {
  const pendingEdit = pendingAction === `edit:${eventDefinition.id}`
  const pendingArchive = pendingAction === `archive:${eventDefinition.id}`
  const pendingRestore = pendingAction === `restore:${eventDefinition.id}`

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${eventDefinition.isActive ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{eventDefinition.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${eventDefinition.legacyEventType ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
              {eventDefinition.legacyEventType ? 'Recordable now' : 'Library only'}
            </span>
            {!eventDefinition.isActive && (
              <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {getOptionLabel(matchPhaseOptions, eventDefinition.matchPhase)} · {getOptionLabel(categoryOptions, eventDefinition.category)} · {getOptionLabel(fourCornerOptions, eventDefinition.fourCorner)}
          </p>
          {eventDefinition.description && (
            <p className="mt-2 text-sm text-gray-700">{eventDefinition.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className={eventDefinition.enabledByDefault ? 'text-green-700' : 'text-gray-500'}>
            {eventDefinition.enabledByDefault ? 'Default on' : 'Default off'}
          </span>
          <span className={eventDefinition.benchmarkable ? 'text-blue-700' : 'text-gray-500'}>
            {eventDefinition.benchmarkable ? 'Benchmarkable' : 'Not benchmarkable'}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
        <p><span className="font-semibold text-gray-900">Age:</span> {formatList(agePhaseOptions, eventDefinition.agePhases)}</p>
        <p><span className="font-semibold text-gray-900">Positions:</span> {formatList(positionOptions, eventDefinition.positionRelevance)}</p>
        {eventDefinition.legacyEventType && (
          <p><span className="font-semibold text-gray-900">Runtime enum:</span> {eventDefinition.legacyEventType}</p>
        )}
      </div>

      <details className="mt-4 rounded-lg bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-bold">Edit metadata</summary>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            runFormAction({
              form: event.currentTarget,
              action: updateEventDefinitionAction,
              pendingLabel: `edit:${eventDefinition.id}`,
              successMessage: 'Event metadata updated.',
            })
          }}
        >
          <input type="hidden" name="eventDefinitionId" value={eventDefinition.id} />
          <EventDefinitionFields
            eventDefinition={eventDefinition}
            matchPhaseOptions={matchPhaseOptions}
            categoryOptions={categoryOptions}
            agePhaseOptions={agePhaseOptions}
            fourCornerOptions={fourCornerOptions}
            positionOptions={positionOptions}
          />
          <button
            type="submit"
            className="mt-4 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={Boolean(pendingAction)}
          >
            {pendingEdit ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </details>

      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault()
          runFormAction({
            form: event.currentTarget,
            action: eventDefinition.isActive ? archiveEventDefinitionAction : restoreEventDefinitionAction,
            pendingLabel: `${eventDefinition.isActive ? 'archive' : 'restore'}:${eventDefinition.id}`,
            successMessage: eventDefinition.isActive ? 'Event archived.' : 'Event restored.',
          })
        }}
      >
        <input type="hidden" name="eventDefinitionId" value={eventDefinition.id} />
        <button
          type="submit"
          className={`rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50 ${eventDefinition.isActive ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}
          disabled={Boolean(pendingAction)}
        >
          {pendingArchive ? 'Archiving...' : pendingRestore ? 'Restoring...' : eventDefinition.isActive ? 'Archive event' : 'Restore event'}
        </button>
      </form>
    </article>
  )
}

function EventDefinitionFields({
  eventDefinition,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
}: {
  eventDefinition?: EventDefinition
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Name
          <input
            name="name"
            defaultValue={eventDefinition?.name ?? ''}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Match phase
          <select
            name="matchPhase"
            defaultValue={eventDefinition?.matchPhase ?? matchPhaseOptions[0]?.value}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          >
            {matchPhaseOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Category
          <select
            name="category"
            defaultValue={eventDefinition?.category ?? categoryOptions[0]?.value}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          4 Corner
          <select
            name="fourCorner"
            defaultValue={eventDefinition?.fourCorner ?? fourCornerOptions[0]?.value}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          >
            {fourCornerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-sm font-medium">
        Description
        <textarea
          name="description"
          defaultValue={eventDefinition?.description ?? ''}
          className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2"
        />
      </label>

      <CheckboxGroup
        label="Age phases"
        name="agePhase"
        options={agePhaseOptions}
        selectedValues={eventDefinition?.agePhases ?? ['YOUTH', 'ADULT']}
      />

      <CheckboxGroup
        label="Position relevance"
        name="positionRelevance"
        options={positionOptions}
        selectedValues={eventDefinition?.positionRelevance ?? ['ALL']}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="enabledByDefault"
            defaultChecked={eventDefinition?.enabledByDefault ?? false}
            disabled={eventDefinition ? !eventDefinition.isActive : false}
          />
          Enabled by default
        </label>
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="benchmarkable"
            defaultChecked={eventDefinition?.benchmarkable ?? false}
          />
          Benchmarkable
        </label>
      </div>
    </div>
  )
}

function CheckboxGroup({
  label,
  name,
  options,
  selectedValues,
}: {
  label: string
  name: string
  options: readonly Option[]
  selectedValues: string[]
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selectedValues.includes(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
