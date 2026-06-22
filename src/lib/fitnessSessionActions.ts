'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import { canManageFitnessSession, canRecordFitnessSession } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type StartFitnessTestMode = 'liveDropout' | 'liveTimedFinish'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getStartMode = (formData: FormData): StartFitnessTestMode | null => {
  const mode = getTextValue(formData, 'mode')

  if (mode === 'liveDropout' || mode === 'liveTimedFinish') return mode
  return null
}

export async function startFitnessTestSession(formData: FormData): Promise<
  | { ok: true; startedAt: string }
  | { ok: false; reason: string }
> {
  const user = await getCurrentUser()
  const fitnessTestSessionId = getTextValue(formData, 'fitnessTestSessionId')
  const mode = getStartMode(formData)

  if (!fitnessTestSessionId) {
    return { ok: false, reason: 'Missing fitness test session.' }
  }

  if (!mode) {
    return { ok: false, reason: 'Missing or invalid recording mode.' }
  }

  const session = await prisma.fitnessTestSession.findUnique({
    where: { id: fitnessTestSessionId },
    include: {
      fitnessTestType: true,
    },
  })

  if (!session) {
    return { ok: false, reason: 'Fitness test session was not found.' }
  }

  if (!(await canRecordFitnessSession(user.id, session.id))) {
    return { ok: false, reason: 'You cannot record this fitness test.' }
  }

  const recordingModes = getFitnessRecordingModes(session.fitnessTestType)
  const isValidMode =
    mode === 'liveDropout'
      ? recordingModes.liveDropout
      : recordingModes.liveTimedFinish

  if (!isValidMode) {
    return { ok: false, reason: 'This recording mode is not valid for this test.' }
  }

  if (session.status === 'IN_PROGRESS') {
    return {
      ok: true,
      startedAt: (session.startedAt ?? new Date()).toISOString(),
    }
  }

  if (session.status === 'COMPLETED') {
    return { ok: false, reason: 'Fitness test is completed.' }
  }

  const startedAt = new Date()

  await prisma.fitnessTestSession.update({
    where: { id: session.id },
    data: {
      status: 'IN_PROGRESS',
      startedAt,
    },
  })

  revalidatePath('/fitness')
  revalidatePath(`/fitness/sessions/${session.id}`)
  revalidatePath(`/fitness/sessions/${session.id}/live`)
  revalidatePath(`/fitness/sessions/${session.id}/timer`)
  revalidatePath(`/fitness/sessions/${session.id}/rankings`)
  revalidatePath('/fitness/progress')

  return { ok: true, startedAt: startedAt.toISOString() }
}

export async function endFitnessTestSession(formData: FormData): Promise<
  | { ok: true; completedAt: string }
  | { ok: false; reason: string }
> {
  const user = await getCurrentUser()
  const fitnessTestSessionId = getTextValue(formData, 'fitnessTestSessionId')

  if (!fitnessTestSessionId) {
    return { ok: false, reason: 'Missing fitness test session.' }
  }

  const session = await prisma.fitnessTestSession.findUnique({
    where: { id: fitnessTestSessionId },
  })

  if (!session) {
    return { ok: false, reason: 'Fitness test session was not found.' }
  }

  if (!(await canRecordFitnessSession(user.id, session.id))) {
    return { ok: false, reason: 'You cannot record this fitness test.' }
  }

  if (session.status === 'DRAFT') {
    return { ok: false, reason: 'Fitness test has not started.' }
  }

  if (session.status === 'COMPLETED') {
    return {
      ok: true,
      completedAt: session.completedAt?.toISOString() ?? '',
    }
  }

  const completedAt = new Date()

  await prisma.fitnessTestSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      completedAt,
    },
  })

  revalidatePath('/fitness')
  revalidatePath(`/fitness/sessions/${session.id}`)
  revalidatePath(`/fitness/sessions/${session.id}/live`)
  revalidatePath(`/fitness/sessions/${session.id}/timer`)
  revalidatePath(`/fitness/sessions/${session.id}/rankings`)
  revalidatePath('/fitness/progress')

  return { ok: true, completedAt: completedAt.toISOString() }
}

export async function reopenFitnessTestSession(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; reason: string }
> {
  const user = await getCurrentUser()
  const fitnessTestSessionId = getTextValue(formData, 'fitnessTestSessionId')

  if (!fitnessTestSessionId) {
    return { ok: false, reason: 'Missing fitness test session.' }
  }

  const session = await prisma.fitnessTestSession.findUnique({
    where: { id: fitnessTestSessionId },
  })

  if (!session) {
    return { ok: false, reason: 'Fitness test session was not found.' }
  }

  if (!(await canManageFitnessSession(user.id, session.id))) {
    return { ok: false, reason: 'You cannot reopen this fitness test.' }
  }

  if (session.status !== 'COMPLETED') {
    return { ok: false, reason: 'Only completed fitness tests can be reopened.' }
  }

  await prisma.fitnessTestSession.update({
    where: { id: session.id },
    data: {
      status: 'IN_PROGRESS',
      completedAt: null,
    },
  })

  revalidatePath('/fitness')
  revalidatePath(`/fitness/sessions/${session.id}`)
  revalidatePath(`/fitness/sessions/${session.id}/live`)
  revalidatePath(`/fitness/sessions/${session.id}/timer`)
  revalidatePath(`/fitness/sessions/${session.id}/rankings`)
  revalidatePath('/fitness/progress')

  return { ok: true }
}
