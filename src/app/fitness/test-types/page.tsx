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

async function updateFitnessTestType(
  formData: FormData
): Promise<FitnessTestTypeActionResult> {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')
  const name = getTextValue(formData, 'name')
  const resultUnit = getTextValue(formData, 'resultUnit')
  const higherIsBetter = getTextValue(formData, 'higherIsBetter') === 'true'
  const allowedModes = formData
    .getAll('allowedRecordingMode')
    .filter((value): value is string => typeof value === 'string')
    .filter(isFitnessRecordingMode)
  const uniqueAllowedModes = Array.from(
    new Set<FitnessRecordingMode>(allowedModes)
  )

  if (!id || !name || !resultUnit) {
    return { ok: false, reason: 'Name and unit are required.' }
  }

  if (uniqueAllowedModes.length === 0) {
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
    uniqueAllowedModes
  )

  await prisma.fitnessTestType.update({
    where: { id: fitnessTestType.id },
    data: {
      name,
      resultUnit,
      higherIsBetter,
      allowedRecordingModes: serializeAllowedRecordingModes(uniqueAllowedModes),
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
    <main className="mx-auto w-full max-w-6xl p-6">
      <PageHeader
        title="Fitness Test Types"
        description="Manage result units, ranking direction and allowed recording modes."
        actions={(
          <Link href="/fitness" className="text-sm font-semibold text-blue-800 hover:underline">
            Back to Fitness
          </Link>
        )}
      />

      <FitnessTestTypesClient
        testTypes={testTypes}
        updateFitnessTestTypeAction={updateFitnessTestType}
      />
    </main>
  )
}
