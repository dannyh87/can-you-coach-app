'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'

import FitnessTestGuidance, { hasFitnessTestGuidance } from '@/components/FitnessTestGuidance'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import FormField from '@/components/ui/FormField'
import ModalShell from '@/components/ui/ModalShell'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'
import {
  fitnessRecordingModeOptions,
  formatFitnessRecordingMode,
  type FitnessRecordingMode,
} from '@/lib/fitnessRecordingModes'

type FitnessTestTypeActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type FitnessTestTypeRow = {
  id: string
  name: string
  resultUnit: string
  higherIsBetter: boolean
  isDefault: boolean
  allowedModes: FitnessRecordingMode[]
  allowedModesLabel: string
  preferredMode: FitnessRecordingMode
  preferredModeLabel: string
  setupInstructions: string | null
  equipmentNeeded: string | null
  scoringNotes: string | null
  spaceRequired: string | null
  coachNotes: string | null
  videoUrl: string | null
  targetScores: string | null
}

type FitnessTestTypesClientProps = {
  testTypes: FitnessTestTypeRow[]
  createFitnessTestTypeAction: (formData: FormData) => Promise<FitnessTestTypeActionResult>
  updateFitnessTestTypeAction: (formData: FormData) => Promise<FitnessTestTypeActionResult>
}

type ModalMode = 'create' | 'edit' | null

export default function FitnessTestTypesClient({
  testTypes,
  createFitnessTestTypeAction,
  updateFitnessTestTypeAction,
}: FitnessTestTypesClientProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedTestType, setSelectedTestType] = useState<FitnessTestTypeRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openCreateModal = () => {
    setSelectedTestType(null)
    setError(null)
    setMessage(null)
    setModalMode('create')
  }

  const openEditModal = (testType: FitnessTestTypeRow) => {
    setSelectedTestType(testType)
    setError(null)
    setMessage(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedTestType(null)
    setError(null)
  }

  const createTestType = async (formData: FormData) => {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const result = await createFitnessTestTypeAction(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedTestType(null)
      setMessage('Fitness test type created.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  const updateTestType = async (formData: FormData) => {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const result = await updateFitnessTestTypeAction(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedTestType(null)
      setMessage('Fitness test type updated.')
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
        title="Tests available to coaches"
        description="Create custom tests or tap an existing test to adjust how coaches record it."
        actions={(
          <Button type="button" onClick={openCreateModal} size="sm">
            Add custom test
          </Button>
        )}
        bodyClassName="p-0"
      >
        {testTypes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              eyebrow="Fitness Test Library"
              title="No tests are available yet"
              description="Add a custom test so coaches can create fitness sessions with the right unit, ranking direction and recording mode."
              action={(
                <Button type="button" onClick={openCreateModal} size="sm">
                  Add custom test
                </Button>
              )}
            />
          </div>
        ) : (
          <>
          <div className="divide-y md:hidden">
            {testTypes.map((testType) => (
              <article
                key={testType.id}
                className="p-4 hover:bg-blue-50/70"
              >
                <button
                  type="button"
                  onClick={() => openEditModal(testType)}
                  className="block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold">{testType.name}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {testType.resultUnit} · {testType.higherIsBetter ? 'Higher is better' : 'Lower is better'}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {testType.isDefault ? 'Default' : 'Custom'}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-gray-500">Allowed modes</dt>
                      <dd className="mt-1 font-semibold text-gray-900">
                        {testType.allowedModesLabel}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-gray-500">Preferred mode</dt>
                      <dd className="mt-1 font-semibold text-gray-900">
                        {testType.preferredModeLabel}
                      </dd>
                    </div>
                  </dl>
                </button>
                <FitnessTestGuidance guidance={testType} compact collapsible title="Setup guidance" className="mt-4" />
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Test name</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Ranking</th>
                  <th className="px-4 py-3 font-medium">Allowed modes</th>
                  <th className="px-4 py-3 font-medium">Preferred mode</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {testTypes.map((testType) => (
                  <Fragment key={testType.id}>
                  <tr
                    onClick={() => openEditModal(testType)}
                    className="cursor-pointer hover:bg-blue-50/70"
                  >
                    <td className="px-4 py-3 font-medium">{testType.name}</td>
                    <td className="px-4 py-3 text-gray-600">{testType.resultUnit}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {testType.higherIsBetter ? 'Higher is better' : 'Lower is better'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{testType.allowedModesLabel}</td>
                    <td className="px-4 py-3 text-gray-600">{testType.preferredModeLabel}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {testType.isDefault ? 'Default' : 'Custom'}
                    </td>
                  </tr>
                  {hasFitnessTestGuidance(testType) && (
                    <tr className="border-b bg-slate-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        <FitnessTestGuidance guidance={testType} compact collapsible title="Setup and target guidance" />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </SectionCard>

      {modalMode && (
        <ModalShell
          title={modalMode === 'create' ? 'Add custom fitness test' : 'Edit fitness test'}
          description={modalMode === 'create'
            ? 'Create a test that matches how your coaches collect results.'
            : 'Update how this test is measured, ranked and recorded.'}
          onClose={closeModal}
          isSubmitting={isSubmitting}
          mode={modalMode === 'create' ? 'create' : 'edit'}
        >
            {error && (
              <Alert variant="error" className="mb-4">{error}</Alert>
            )}

            {modalMode === 'create' ? (
              <FitnessTestTypeForm
                key="create"
                isSubmitting={isSubmitting}
                submitLabel="Create Fitness Test"
                onSubmit={createTestType}
              />
            ) : selectedTestType ? (
              <FitnessTestTypeForm
                key={selectedTestType.id}
                testType={selectedTestType}
                isSubmitting={isSubmitting}
                submitLabel="Save Fitness Test"
                onSubmit={updateTestType}
              />
            ) : null}
        </ModalShell>
      )}
    </>
  )
}

function FitnessTestTypeForm({
  testType,
  isSubmitting,
  submitLabel,
  onSubmit,
}: {
  testType?: FitnessTestTypeRow
  isSubmitting: boolean
  submitLabel: string
  onSubmit: (formData: FormData) => Promise<void>
}) {
  const [allowedModes, setAllowedModes] = useState<FitnessRecordingMode[]>(
    testType?.allowedModes ?? ['MANUAL']
  )
  const [preferredMode, setPreferredMode] = useState<FitnessRecordingMode>(
    testType?.preferredMode ?? 'MANUAL'
  )

  const updateAllowedMode = (mode: FitnessRecordingMode, isChecked: boolean) => {
    const nextAllowedModes = isChecked
      ? [...allowedModes, mode]
      : allowedModes.filter((allowedMode) => allowedMode !== mode)

    if (nextAllowedModes.length === 0) return

    setAllowedModes(nextAllowedModes)
    if (!nextAllowedModes.includes(preferredMode)) {
      setPreferredMode(nextAllowedModes[0])
    }
  }

  return (
    <form action={onSubmit} className={formGridClassName}>
      {testType && <input type="hidden" name="id" value={testType.id} />}

      <FormField label="Test name">
        <input
          name="name"
          required
          defaultValue={testType?.name ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="How results are measured">
        <input
          name="resultUnit"
          required
          defaultValue={testType?.resultUnit ?? ''}
          className={fieldClassName}
        />
      </FormField>

      <FormField label="How rankings work">
        <select
          name="higherIsBetter"
          defaultValue={testType?.higherIsBetter === false ? 'false' : 'true'}
          className={fieldClassName}
        >
          <option value="true">Higher is better</option>
          <option value="false">Lower is better</option>
        </select>
      </FormField>

      <FormField label="Coach preferred recording mode">
        <select
          name="preferredRecordingMode"
          value={preferredMode}
          onChange={(event) => setPreferredMode(event.target.value as FitnessRecordingMode)}
          className={fieldClassName}
        >
          {allowedModes.map((mode) => (
            <option key={mode} value={mode}>
              {formatFitnessRecordingMode(mode)}
            </option>
          ))}
        </select>
      </FormField>

      <fieldset className="rounded-lg border p-4 md:col-span-2">
        <legend className="px-1 text-sm font-medium">Recording modes coaches can use</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {fitnessRecordingModeOptions.map((option) => (
            <label key={option.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium">
              <input
                type="checkbox"
                name="allowedRecordingMode"
                value={option.value}
                checked={allowedModes.includes(option.value)}
                onChange={(event) => updateAllowedMode(option.value, event.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
        <summary className="cursor-pointer text-sm font-bold text-slate-800">
          Advanced guidance
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <GuidanceTextArea
            label="Setup instructions"
            name="setupInstructions"
            defaultValue={testType?.setupInstructions}
          />
          <GuidanceTextArea
            label="Equipment needed"
            name="equipmentNeeded"
            defaultValue={testType?.equipmentNeeded}
          />
          <GuidanceTextArea
            label="Space required"
            name="spaceRequired"
            defaultValue={testType?.spaceRequired}
          />
          <GuidanceTextArea
            label="Scoring notes"
            name="scoringNotes"
            defaultValue={testType?.scoringNotes}
          />
          <GuidanceTextArea
            label="Target scores"
            name="targetScores"
            defaultValue={testType?.targetScores}
          />
          <GuidanceTextArea
            label="Coach notes"
            name="coachNotes"
            defaultValue={testType?.coachNotes}
          />
          <FormField label="Video URL">
            <input
              name="videoUrl"
              type="url"
              defaultValue={testType?.videoUrl ?? ''}
              className={fieldClassName}
              placeholder="https://www.youtube.com/..."
            />
          </FormField>
        </div>
      </details>

      <div className="flex justify-end md:col-span-2">
        <Button type="submit" disabled={isSubmitting} fullWidth>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function GuidanceTextArea({
  label,
  name,
  defaultValue,
}: {
  label: string
  name: string
  defaultValue?: string | null
}) {
  return (
    <FormField label={label}>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ''}
        rows={4}
        className={fieldClassName}
      />
    </FormField>
  )
}
