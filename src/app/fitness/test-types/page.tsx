import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import FitnessTestTypesClient from '@/app/fitness/test-types/FitnessTestTypesClient'
import PageHeader from '@/components/ui/PageHeader'
import {
  formatFitnessRecordingMode,
  getFitnessRecordingModes,
  isFitnessRecordingMode,
  parsePreferredRecordingMode,
  serializeAllowedRecordingModes,
  type FitnessRecordingMode,
} from '@/lib/fitnessRecordingModes'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type FitnessTestTypeActionResult =
  | { ok: true }
  | { ok: false; reason: string }

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getAllowedRecordingModes = (formData: FormData) => {
  const allowedModes = formData
    .getAll('allowedRecordingMode')
    .filter((value): value is string => typeof value === 'string')
    .filter(isFitnessRecordingMode)

  return Array.from(new Set<FitnessRecordingMode>(allowedModes))
}

async function createFitnessTestType(
  formData: FormData
): Promise<FitnessTestTypeActionResult> {
  'use server'

  const user = await getCurrentUser()
  const name = getTextValue(formData, 'name')
  const resultUnit = getTextValue(formData, 'resultUnit')
  const higherIsBetter = getTextValue(formData, 'higherIsBetter') === 'true'
  const allowedModes = getAllowedRecordingModes(formData)

  if (!name || !resultUnit) {
    return { ok: false, reason: 'Name and unit are required.' }
  }

  if (allowedModes.length === 0) {
    return { ok: false, reason: 'Select at least one recording mode.' }
  }

  const existingFitnessTestType = await prisma.fitnessTestType.findFirst({
    where: {
      name,
      OR: [{ isDefault: true }, { userId: user.id }],
    },
    select: { id: true },
  })

  if (existingFitnessTestType) {
    return { ok: false, reason: 'A fitness test type with this name already exists.' }
  }

  const preferredRecordingMode = parsePreferredRecordingMode(
    getTextValue(formData, 'preferredRecordingMode'),
    allowedModes
  )

  await prisma.fitnessTestType.create({
    data: {
      user: {
        connect: { id: user.id },
      },
      name,
      resultUnit,
      higherIsBetter,
      isDefault: false,
      allowedRecordingModes: serializeAllowedRecordingModes(allowedModes),
      preferredRecordingMode,
    },
  })

  revalidatePath('/fitness')
  revalidatePath('/fitness/test-types')
  revalidatePath('/fitness/progress')

  return { ok: true }
}

async function updateFitnessTestType(
  formData: FormData
): Promise<FitnessTestTypeActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')
  const name = getTextValue(formData, 'name')
  const resultUnit = getTextValue(formData, 'resultUnit')
  const higherIsBetter = getTextValue(formData, 'higherIsBetter') === 'true'
  const allowedModes = getAllowedRecordingModes(formData)

  if (!id || !name || !resultUnit) {
    return { ok: false, reason: 'Name and unit are required.' }
  }

  if (allowedModes.length === 0) {
    return { ok: false, reason: 'Select at least one recording mode.' }
  }

  const fitnessTestType = await prisma.fitnessTestType.findFirst({
    where: {
      id,
      OR: [{ isDefault: true }, { userId: user.id }],
    },
    select: { id: true },
  })

  if (!fitnessTestType) {
    return { ok: false, reason: 'Fitness test type was not found.' }
  }

  const preferredRecordingMode = parsePreferredRecordingMode(
    getTextValue(formData, 'preferredRecordingMode'),
    allowedModes
  )

  await prisma.fitnessTestType.update({
    where: { id: fitnessTestType.id },
    data: {
      name,
      resultUnit,
      higherIsBetter,
      allowedRecordingModes: serializeAllowedRecordingModes(allowedModes),
      preferredRecordingMode,
    },
  })

  revalidatePath('/fitness')
  revalidatePath('/fitness/test-types')
  revalidatePath('/fitness/progress')

  return { ok: true }
}

export default async function FitnessTestTypesPage() {
  const user = await getCurrentUser()
  const fitnessTestTypes = await prisma.fitnessTestType.findMany({
    where: {
      OR: [{ isDefault: true }, { userId: user.id }],
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const testTypes = fitnessTestTypes.map((fitnessTestType) => {
    const recordingModes = getFitnessRecordingModes(fitnessTestType)

    return {
      id: fitnessTestType.id,
      name: fitnessTestType.name,
      resultUnit: fitnessTestType.resultUnit,
      higherIsBetter: fitnessTestType.higherIsBetter,
      isDefault: fitnessTestType.isDefault,
      allowedModes: recordingModes.allowedModes,
      allowedModesLabel: recordingModes.allowedModes
        .map((mode) => formatFitnessRecordingMode(mode))
        .join(', '),
      preferredMode: recordingModes.preferredMode as FitnessRecordingMode,
      preferredModeLabel: formatFitnessRecordingMode(recordingModes.preferredMode),
    }
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Fitness Test Library"
        description="Choose the tests your coaches use, how each one is recorded, and how results should be interpreted."
        actions={(
          <Link href="/fitness" className="text-sm font-semibold text-blue-800 hover:underline">
            Back to Fitness
          </Link>
        )}
      />

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Manual entry</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Best when a stopwatch, timing gates or another device gives you the final score.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Live dropout</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Best for tests where players drop out one by one, such as bleep or Yo-Yo tests.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Live timed finish</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Best when each player finishes at a different time and the coach taps finish live.
          </p>
        </div>
      </section>

      <FitnessTestTypesClient
        testTypes={testTypes}
        createFitnessTestTypeAction={createFitnessTestType}
        updateFitnessTestTypeAction={updateFitnessTestType}
      />
    </main>
  )
}
