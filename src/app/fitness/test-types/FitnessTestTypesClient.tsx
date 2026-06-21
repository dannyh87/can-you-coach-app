'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/Button'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName } from '@/components/ui/formStyles'
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
        <p className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      <SectionCard
        title="Test Types"
        description="Click a row to edit recording-mode settings."
        actions={(
          <Button type="button" onClick={openCreateModal} size="sm">
            New Fitness Test Type
          </Button>
        )}
        bodyClassName="p-0"
      >
        {testTypes.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No fitness test types found.</p>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr
                    key={testType.id}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {modalMode === 'create'
                    ? 'New Fitness Test Type'
                    : 'Edit Fitness Test Type'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modalMode === 'create'
                    ? 'Create a custom test type for this local coach profile.'
                    : 'Update result settings and allowed recording modes.'}
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

            {modalMode === 'create' ? (
              <FitnessTestTypeForm
                key="create"
                isSubmitting={isSubmitting}
                submitLabel="Create Fitness Test Type"
                onSubmit={createTestType}
              />
            ) : selectedTestType ? (
              <FitnessTestTypeForm
                key={selectedTestType.id}
                testType={selectedTestType}
                isSubmitting={isSubmitting}
                submitLabel="Save Fitness Test Type"
                onSubmit={updateTestType}
              />
            ) : null}
          </div>
        </div>
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
    <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
      {testType && <input type="hidden" name="id" value={testType.id} />}

      <label className="text-sm font-medium">
        Name
        <input
          name="name"
          required
          defaultValue={testType?.name ?? ''}
          className={fieldClassName}
        />
      </label>

      <label className="text-sm font-medium">
        Unit
        <input
          name="resultUnit"
          required
          defaultValue={testType?.resultUnit ?? ''}
          className={fieldClassName}
        />
      </label>

      <label className="text-sm font-medium">
        Ranking direction
        <select
          name="higherIsBetter"
          defaultValue={testType?.higherIsBetter === false ? 'false' : 'true'}
          className={fieldClassName}
        >
          <option value="true">Higher is better</option>
          <option value="false">Lower is better</option>
        </select>
      </label>

      <label className="text-sm font-medium">
        Preferred recording mode
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
      </label>

      <fieldset className="rounded-lg border p-4 md:col-span-2">
        <legend className="px-1 text-sm font-medium">Allowed recording modes</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {fitnessRecordingModeOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm font-medium">
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

      <div className="flex justify-end md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
