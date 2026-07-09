import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import FitnessClient from '@/app/fitness/FitnessClient'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleSessionWhere, accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser, isClerkEnabled } from '@/lib/auth'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import {
  formatFitnessSessionStatus,
  getFitnessSessionStatusClasses,
} from '@/lib/fitnessSessionStatus'
import { ensureDefaultClub } from '@/lib/localUser'
import { canManageFitnessSession, canManageTeamData } from '@/lib/permissions'
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

  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  const fitnessTestTypeId = getTextValue(formData, 'fitnessTestTypeId')
  const date = getTextValue(formData, 'date')
  const notes = getTextValue(formData, 'notes')

  if (!teamId || !fitnessTestTypeId || !date) {
    return { ok: false, reason: 'Team, test type and date are required.' }
  }

  if (!(await canManageTeamData(user.id, teamId))) {
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
    return { ok: false, reason: 'You cannot delete this fitness test session.' }
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
  const user = await getCurrentUser()
  if (!isClerkEnabled()) await ensureDefaultClub(user.id)
  const manageableTeamIds = await getManageableTeamIds(user.id)
  const [spectatorAccessCount, membershipCount] = await Promise.all([
    prisma.spectatorAccess.count({ where: { userId: user.id } }),
    prisma.clubMembership.count({ where: { userId: user.id } }),
  ])

  const teams = await prisma.team.findMany({
    where: await accessibleTeamWhere(user.id),
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
    where: await accessibleSessionWhere(user.id),
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

  const teamOptions = teams.filter((team) => manageableTeamIds.includes(team.id)).map((team) => ({
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
      canDelete: manageableTeamIds.includes(session.teamId) && session.status !== 'IN_PROGRESS',
    }
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Fitness Testing"
        description="Start a test, continue recording, or review results."
      />

      {teams.length === 0 ? (
        spectatorAccessCount > 0 ? (
          <EmptyState
            eyebrow="Linked player access"
            title="Fitness testing is managed by coaches."
            description="Parents and spectators can view linked player information and recent fitness results in My Player, but cannot create or record fitness tests."
            action={(
              <Link href="/my-player" className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Go to My Player
              </Link>
            )}
          />
        ) : membershipCount === 0 && user.onboardingRole === 'COACH' ? (
          <EmptyState
            eyebrow="Team invite needed"
            title="Ask your club for a team invite."
            description="Fitness tests appear after a club official or head coach invites you to a team. Open the invite link directly and sign in with the invited email."
          />
        ) : membershipCount === 0 && user.onboardingRole === 'PARENT_SPECTATOR' ? (
          <EmptyState
            eyebrow="Player invite needed"
            title="Waiting for your player link."
            description="Ask your coach or club official to invite you to a player. Fitness results for that player will appear in My Player once recorded by coaches."
            action={(
              <Link href="/my-player" className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Go to My Player
              </Link>
            )}
          />
        ) : (
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
        )
      ) : fitnessTestTypes.length === 0 ? (
        <EmptyState
          title="No fitness test types found"
          description="Add or seed fitness test types before creating a test session."
        />
      ) : (
        <FitnessClient
          sessions={sessionRows}
          teams={teamOptions}
          canCreateSessions={teamOptions.length > 0}
          fitnessTestTypes={fitnessTestTypeOptions}
          createFitnessTestSessionAction={createFitnessTestSession}
          deleteFitnessTestSessionAction={deleteFitnessTestSession}
        />
      )}
    </main>
  )
}
