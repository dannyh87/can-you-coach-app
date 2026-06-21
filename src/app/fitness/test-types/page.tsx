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
import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

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

  const user = await getLocalUser()
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
      userId: user.id,
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

  const user = await getLocalUser()
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
  const user = await getLocalUser()
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
        title="Fitness Test Types"
        description="Choose how each test should be recorded, which unit it uses and whether higher or lower scores are better."
        actions={(
          <Link href="/fitness" className="text-sm font-semibold text-blue-800 hover:underline">
            Back to Fitness
          </Link>
        )}
      />

      <FitnessTestTypesClient
        testTypes={testTypes}
        createFitnessTestTypeAction={createFitnessTestType}
        updateFitnessTestTypeAction={updateFitnessTestType}
      />
    </main>
  )
}
