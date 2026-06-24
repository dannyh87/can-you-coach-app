import Link from 'next/link'
import { redirect } from 'next/navigation'

import FitnessSessionWizard from '@/app/fitness/sessions/new/FitnessSessionWizard'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { formatFitnessRecordingMode, getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import { canManageTeamData } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function createFitnessSessionFromWizard(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  const fitnessTestTypeId = getTextValue(formData, 'fitnessTestTypeId')
  const date = getTextValue(formData, 'date')
  const notes = getTextValue(formData, 'notes')
  const unavailablePlayerIds = formData
    .getAll('unavailablePlayerId')
    .filter((value): value is string => typeof value === 'string')

  if (!teamId || !fitnessTestTypeId || !date) return { ok: false as const, reason: 'Team, test type and date are required.' }
  if (!(await canManageTeamData(user.id, teamId))) return { ok: false as const, reason: 'You cannot create a session for this team.' }

  const fitnessTestType = await prisma.fitnessTestType.findFirst({
    where: {
      id: fitnessTestTypeId,
      OR: [{ isDefault: true }, { userId: user.id }],
    },
  })
  if (!fitnessTestType) return { ok: false as const, reason: 'Fitness test type was not found.' }

  const activePlayers = await prisma.player.findMany({
    where: { teamId, isActive: true },
    select: { id: true },
  })
  const activePlayerIds = new Set(activePlayers.map((player) => player.id))
  const validUnavailablePlayerIds = unavailablePlayerIds.filter((playerId) => activePlayerIds.has(playerId))

  const session = await prisma.fitnessTestSession.create({
    data: {
      teamId,
      fitnessTestTypeId,
      date: new Date(`${date}T00:00:00`),
      notes: notes || null,
      results: {
        create: validUnavailablePlayerIds.map((playerId) => ({
          playerId,
          status: 'ABSENT',
          notes: 'Marked unavailable during setup.',
        })),
      },
    },
  })

  const recordingModes = getFitnessRecordingModes(fitnessTestType)
  if (recordingModes.preferredMode === 'LIVE_DROPOUT' && recordingModes.liveDropout) {
    redirect(`/fitness/sessions/${session.id}/live`)
  }
  if (recordingModes.preferredMode === 'LIVE_TIMED_FINISH' && recordingModes.liveTimedFinish) {
    redirect(`/fitness/sessions/${session.id}/timer`)
  }

  redirect(`/fitness/sessions/${session.id}`)
}

export default async function NewFitnessSessionPage() {
  const user = await getCurrentUser()
  const manageableTeamIds = await getManageableTeamIds(user.id)
  const teams = await prisma.team.findMany({
    where: {
      AND: [await accessibleTeamWhere(user.id), { id: { in: manageableTeamIds } }],
    },
    include: {
      club: true,
      players: {
        where: { isActive: true },
        orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
      },
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const fitnessTestTypes = await prisma.fitnessTestType.findMany({
    where: { OR: [{ isDefault: true }, { userId: user.id }] },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const teamOptions = teams.map((team) => ({
    id: team.id,
    name: team.name,
    clubName: team.club.name,
    players: team.players.map((player) => ({
      id: player.id,
      name: `${player.firstName} ${player.surname}`,
      squadNumber: player.squadNumber,
      preferredPosition: player.preferredPosition,
    })),
  }))

  const testTypeOptions = fitnessTestTypes.map((fitnessTestType) => {
    const recordingModes = getFitnessRecordingModes(fitnessTestType)
    return {
      id: fitnessTestType.id,
      name: fitnessTestType.name,
      resultUnit: fitnessTestType.resultUnit,
      recordingModeLabel: recordingModes.label,
      preferredMode: recordingModes.preferredMode,
      preferredModeLabel: formatFitnessRecordingMode(recordingModes.preferredMode),
    }
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/fitness" className="text-sm font-semibold text-blue-800 hover:underline">
        Back to Fitness
      </Link>
      <PageHeader title="Start Fitness Test" description="Set up the test in a few quick steps before recording starts." />
      <FitnessSessionWizard
        teams={teamOptions}
        fitnessTestTypes={testTypeOptions}
        createAction={createFitnessSessionFromWizard}
      />
    </main>
  )
}
