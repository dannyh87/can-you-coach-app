import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import FitnessClient from '@/app/fitness/FitnessClient'
import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import {
  formatFitnessSessionStatus,
  getFitnessSessionStatusClasses,
} from '@/lib/fitnessSessionStatus'
import { prisma } from '@/lib/prisma'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatDateTime = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
    : 'Not started'

const formatDateInputValue = (date: Date) => date.toISOString().split('T')[0]

type FitnessActionResult =
  | { ok: true }
  | { ok: false; reason: string }

async function userOwnsTeam(userId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      club: {
        userId,
      },
    },
  })

  return Boolean(team)
}

async function userCanUseFitnessTestType(userId: string, fitnessTestTypeId: string) {
  const fitnessTestType = await prisma.fitnessTestType.findFirst({
    where: {
      id: fitnessTestTypeId,
      OR: [{ isDefault: true }, { userId }],
    },
  })

  return Boolean(fitnessTestType)
}

async function createFitnessTestSession(
  formData: FormData
): Promise<FitnessActionResult> {
  'use server'

  const user = await getLocalUser()
  const teamId = getTextValue(formData, 'teamId')
  const fitnessTestTypeId = getTextValue(formData, 'fitnessTestTypeId')
  const date = getTextValue(formData, 'date')
  const notes = getTextValue(formData, 'notes')

  if (!teamId || !fitnessTestTypeId || !date) {
    return { ok: false, reason: 'Team, test type and date are required.' }
  }

  if (!(await userOwnsTeam(user.id, teamId))) {
    return { ok: false, reason: 'You cannot create a session for this team.' }
  }

  if (!(await userCanUseFitnessTestType(user.id, fitnessTestTypeId))) {
    return { ok: false, reason: 'Fitness test type was not found.' }
  }

  await prisma.fitnessTestSession.create({
    data: {
      teamId,
      fitnessTestTypeId,
      date: new Date(`${date}T00:00:00`),
      notes: notes || null,
    },
  })

  revalidatePath('/fitness')
  return { ok: true }
}

async function deleteFitnessTestSession(
  formData: FormData
): Promise<FitnessActionResult> {
  'use server'

  const user = await getLocalUser()
  const fitnessTestSessionId = getTextValue(formData, 'fitnessTestSessionId')

  if (!fitnessTestSessionId) {
    return { ok: false, reason: 'Missing fitness test session.' }
  }

  const session = await prisma.fitnessTestSession.findFirst({
    where: {
      id: fitnessTestSessionId,
      team: {
        club: {
          userId: user.id,
        },
      },
    },
  })

  if (!session) {
    return { ok: false, reason: 'Fitness test session was not found.' }
  }

  if (session.status === 'IN_PROGRESS') {
    return {
      ok: false,
      reason: 'Live fitness tests cannot be deleted. End the test before deleting it.',
    }
  }

  await prisma.fitnessTestSession.delete({ where: { id: session.id } })

  revalidatePath('/fitness')
  revalidatePath('/fitness/progress')
  return { ok: true }
}

export default async function FitnessPage() {
  const user = await getLocalUser()
  await ensureDefaultClub(user.id)

  const teams = await prisma.team.findMany({
    where: {
      club: {
        userId: user.id,
      },
    },
    include: {
      club: true,
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const fitnessTestTypes = await prisma.fitnessTestType.findMany({
    where: {
      OR: [{ isDefault: true }, { userId: user.id }],
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const sessions = await prisma.fitnessTestSession.findMany({
    where: {
      team: {
        club: {
          userId: user.id,
        },
      },
    },
    include: {
      team: {
        include: {
          club: true,
        },
      },
      fitnessTestType: true,
      _count: {
        select: {
          results: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  const teamOptions = teams.map((team) => ({
    id: team.id,
    name: team.name,
    clubName: team.club.name,
  }))

  const fitnessTestTypeOptions = fitnessTestTypes.map((fitnessTestType) => ({
    id: fitnessTestType.id,
    name: fitnessTestType.name,
    resultUnit: fitnessTestType.resultUnit,
  }))

  const sessionRows = sessions.map((session) => {
    const recordingModes = getFitnessRecordingModes(session.fitnessTestType)

    return {
      id: session.id,
      dateDisplay: formatDate(session.date),
      dateInput: formatDateInputValue(session.date),
      teamName: session.team.name,
      clubName: session.team.club.name,
      fitnessTestTypeName: session.fitnessTestType.name,
      resultUnit: session.fitnessTestType.resultUnit,
      higherIsBetter: session.fitnessTestType.higherIsBetter,
      status: session.status,
      statusLabel: formatFitnessSessionStatus(session.status),
      statusClasses: getFitnessSessionStatusClasses(session.status),
      startedAtDisplay: formatDateTime(session.startedAt),
      completedAtDisplay: formatDateTime(session.completedAt),
      notes: session.notes,
      resultCount: session._count.results,
      recordingModeLabel: recordingModes.label,
      manualEntry: recordingModes.manualEntry,
      liveDropout: recordingModes.liveDropout,
      liveTimedFinish: recordingModes.liveTimedFinish,
    }
  })

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fitness Testing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create fitness test sessions for teams and enter player results.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/fitness/progress" className="text-blue-600 hover:underline">
            View Progress
          </Link>
          <Link href="/club-setup" className="text-blue-600 hover:underline">
            Club Setup
          </Link>
        </div>
      </div>

      {teams.length === 0 ? (
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="text-xl font-bold">Create a team first</h2>
          <p className="mt-2 text-sm text-gray-500">
            Fitness test sessions must belong to a team.
          </p>
          <Link
            href="/club-setup"
            className="mt-4 inline-flex rounded bg-blue-600 px-4 py-2 font-medium text-white"
          >
            Go to Club Setup
          </Link>
        </section>
      ) : fitnessTestTypes.length === 0 ? (
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="text-xl font-bold">No fitness test types found</h2>
          <p className="mt-2 text-sm text-gray-500">
            Run the Prisma seed command to create the default fitness test types.
          </p>
        </section>
      ) : (
        <FitnessClient
          sessions={sessionRows}
          teams={teamOptions}
          fitnessTestTypes={fitnessTestTypeOptions}
          createFitnessTestSessionAction={createFitnessTestSession}
          deleteFitnessTestSessionAction={deleteFitnessTestSession}
        />
      )}
    </main>
  )
}
