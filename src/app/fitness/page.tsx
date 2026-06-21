import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import FitnessClient from '@/app/fitness/FitnessClient'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import {
  formatFitnessSessionStatus,
  getFitnessSessionStatusClasses,
} from '@/lib/fitnessSessionStatus'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

  const fitnessTestTypeOptions = fitnessTestTypes.map((fitnessTestType) => {
    const recordingModes = getFitnessRecordingModes(fitnessTestType)

    return {
      id: fitnessTestType.id,
      name: fitnessTestType.name,
      resultUnit: fitnessTestType.resultUnit,
      recordingModeLabel: recordingModes.label,
    }
  })

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
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Fitness Testing"
        description="Create a test session, record results using the right mode, then review rankings and progress with the squad."
        actions={(
          <>
            <Link href="/fitness/progress" className="text-sm font-semibold text-blue-800 hover:underline">
              View Progress
            </Link>
            <Link href="/fitness/test-types" className="text-sm font-semibold text-blue-800 hover:underline">
              Fitness Test Types
            </Link>
            <Link href="/club-setup" className="text-sm font-semibold text-blue-800 hover:underline">
              Club Setup
            </Link>
          </>
        )}
      />

      {teams.length === 0 ? (
        <EmptyState
          title="Create a team first"
          description="Fitness test sessions must belong to a team."
          action={(
          <Link
            href="/club-setup"
            className="inline-flex"
          >
            <Button>Go to Club Setup</Button>
          </Link>
          )}
        />
      ) : fitnessTestTypes.length === 0 ? (
        <EmptyState
          title="No fitness test types found"
          description="Add or seed fitness test types before creating a test session."
        />
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
