'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import ModalShell from '@/components/ui/ModalShell'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'

type SetupActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type SetupAction = (formData: FormData) => Promise<SetupActionResult>

export type Option = {
  value: string
  label: string
}

type ClubSummary = {
  id: string
  name: string
}

export type ClubEventRow = {
  id: string
  clubId: string
  name: string
  description: string | null
  subcategory: string | null
  videoUrl: string | null
  matchPhase: string
  category: string
  matchDayGroup: string | null
  agePhases: string[]
  fourCorner: string
  positionRelevance: string[]
  enabledByDefault: boolean
  benchmarkable: boolean
  requiresLocation: boolean
  isActive: boolean
  usedCount: number
}

type ClubEventsSectionProps = {
  club: ClubSummary
  events: ClubEventRow[]
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  matchDayGroupOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
  createClubEventAction: SetupAction
  updateClubEventAction: SetupAction
  archiveClubEventAction: SetupAction
  restoreClubEventAction: SetupAction
}

const getOptionLabel = (options: readonly Option[], value: string) =>
  options.find((option) => option.value === value)?.label ?? ''

export default function ClubEventsSection({
  club,
  events,
  matchPhaseOptions,
  categoryOptions,
  matchDayGroupOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
  createClubEventAction,
  updateClubEventAction,
  archiveClubEventAction,
  restoreClubEventAction,
}: ClubEventsSectionProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<'addClubEvent' | 'editClubEvent' | null>(null)
  const [selectedClubEvent, setSelectedClubEvent] = useState<ClubEventRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedClubEvent(null)
    setError(null)
  }

  const openAddModal = () => {
    setSelectedClubEvent(null)
    setError(null)
    setModalMode('addClubEvent')
  }

  const openEditModal = (eventDefinition: ClubEventRow) => {
    setSelectedClubEvent(eventDefinition)
    setError(null)
    setModalMode('editClubEvent')
  }

  const submitAction = async (action: SetupAction, formData: FormData) => {
    setIsSubmitting(true)
    setError(null)

    const result = await action(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedClubEvent(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  return (
    <>
      <SectionCard
        className="mt-6"
        title="Club Events"
        description={`Custom Match Day events for ${club.name}. Global events still appear for every club.`}
        actions={(
          <Button type="button" onClick={openAddModal} size="sm">
            Add Club Event
          </Button>
        )}
        bodyClassName="p-0"
      >
        {events.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No club-specific events yet.</p>
        ) : (
          <div className="divide-y">
            {events.map((eventDefinition) => (
              <div key={eventDefinition.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-950">{eventDefinition.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${eventDefinition.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                      {eventDefinition.isActive ? 'Active' : 'Archived'}
                    </span>
                    {eventDefinition.enabledByDefault && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">Default</span>}
                    {eventDefinition.requiresLocation && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Location</span>}
                    {eventDefinition.usedCount > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Used</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {getOptionLabel(matchDayGroupOptions, eventDefinition.matchDayGroup ?? '') || getOptionLabel(categoryOptions, eventDefinition.category)}
                    {eventDefinition.subcategory ? ` · ${eventDefinition.subcategory}` : ''}
                  </p>
                  {eventDefinition.description && <p className="mt-2 max-w-2xl text-sm text-gray-600">{eventDefinition.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {eventDefinition.usedCount === 0 && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => openEditModal(eventDefinition)}>
                      Edit
                    </Button>
                  )}
                  <form action={(formData) => submitAction(eventDefinition.isActive ? archiveClubEventAction : restoreClubEventAction, formData)}>
                    <input type="hidden" name="eventDefinitionId" value={eventDefinition.id} />
                    <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting}>
                      {eventDefinition.isActive ? 'Archive' : 'Restore'}
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {modalMode && (
        <ModalShell
          title={modalMode === 'addClubEvent' ? 'Add Club Event' : 'Edit Club Event'}
          description="Changes are saved only after a successful action."
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode="create"
        >
          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {modalMode === 'addClubEvent' && (
            <ClubEventForm
              club={club}
              action={createClubEventAction}
              submitLabel="Create Club Event"
              isSubmitting={isSubmitting}
              onSubmit={submitAction}
              matchPhaseOptions={matchPhaseOptions}
              categoryOptions={categoryOptions}
              matchDayGroupOptions={matchDayGroupOptions}
              agePhaseOptions={agePhaseOptions}
              fourCornerOptions={fourCornerOptions}
              positionOptions={positionOptions}
            />
          )}

          {modalMode === 'editClubEvent' && selectedClubEvent && (
            <ClubEventForm
              club={club}
              eventDefinition={selectedClubEvent}
              action={updateClubEventAction}
              submitLabel="Save Club Event"
              isSubmitting={isSubmitting}
              onSubmit={submitAction}
              matchPhaseOptions={matchPhaseOptions}
              categoryOptions={categoryOptions}
              matchDayGroupOptions={matchDayGroupOptions}
              agePhaseOptions={agePhaseOptions}
              fourCornerOptions={fourCornerOptions}
              positionOptions={positionOptions}
            />
          )}
        </ModalShell>
      )}
    </>
  )
}

function ClubEventForm({
  club,
  eventDefinition,
  action,
  submitLabel,
  isSubmitting,
  onSubmit,
  matchPhaseOptions,
  categoryOptions,
  matchDayGroupOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
}: {
  club: ClubSummary
  eventDefinition?: ClubEventRow
  action: SetupAction
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (action: SetupAction, formData: FormData) => Promise<void>
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  matchDayGroupOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className={formGridClassName}>
      {eventDefinition && <input type="hidden" name="eventDefinitionId" value={eventDefinition.id} />}
      <input type="hidden" name="clubId" value={club.id} />

      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 md:col-span-2">
        Club event for <span className="font-bold">{club.name}</span>. These events are DB-only and appear only for teams in this club.
      </p>

      <FormField label="Event name">
        <input
          name="name"
          required
          defaultValue={eventDefinition?.name ?? ''}
          className={fieldClassName}
          placeholder="e.g. Pressing trigger"
        />
      </FormField>

      <FormField label="Match phase">
        <select name="matchPhase" required defaultValue={eventDefinition?.matchPhase ?? matchPhaseOptions[0]?.value} className={fieldClassName}>
          {matchPhaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>

      <FormField label="Category">
        <select name="category" required defaultValue={eventDefinition?.category ?? categoryOptions[0]?.value} className={fieldClassName}>
          {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>

      <FormField label="Match Day group">
        <select name="matchDayGroup" defaultValue={eventDefinition?.matchDayGroup ?? ''} className={fieldClassName}>
          <option value="">Infer from metadata</option>
          {matchDayGroupOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>

      <FormField label="Subcategory">
        <input name="subcategory" defaultValue={eventDefinition?.subcategory ?? ''} className={fieldClassName} placeholder="Optional" />
      </FormField>

      <FormField label="4 Corner">
        <select name="fourCorner" required defaultValue={eventDefinition?.fourCorner ?? fourCornerOptions[0]?.value} className={fieldClassName}>
          {fourCornerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Description">
          <textarea name="description" defaultValue={eventDefinition?.description ?? ''} className={fieldClassName} rows={3} />
        </FormField>
      </div>

      <div className="md:col-span-2">
        <FormField label="Video URL">
          <input type="url" name="videoUrl" defaultValue={eventDefinition?.videoUrl ?? ''} className={fieldClassName} placeholder="https://..." />
        </FormField>
      </div>

      <CheckboxGroup label="Age phases" name="agePhase" options={agePhaseOptions} selectedValues={eventDefinition?.agePhases ?? ['YOUTH', 'ADULT']} />
      <CheckboxGroup label="Position relevance" name="positionRelevance" options={positionOptions} selectedValues={eventDefinition?.positionRelevance ?? ['ALL']} />

      <div className="grid gap-2 md:col-span-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input type="checkbox" name="enabledByDefault" defaultChecked={eventDefinition?.enabledByDefault ?? false} disabled={eventDefinition ? !eventDefinition.isActive : false} />
          Enabled by default
        </label>
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input type="checkbox" name="requiresLocation" defaultChecked={eventDefinition?.requiresLocation ?? false} />
          Requires location
        </label>
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input type="checkbox" name="benchmarkable" defaultChecked={eventDefinition?.benchmarkable ?? false} />
          Benchmarkable
        </label>
      </div>

      <div className="flex items-end md:col-span-2">
        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
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
    <fieldset className="md:col-span-2">
      <legend className="text-sm font-bold">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm">
            <input type="checkbox" name={name} value={option.value} defaultChecked={selectedValues.includes(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
