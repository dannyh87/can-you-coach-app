import { getManageableTeamIds, getRecordableTeamIds } from '@/lib/accessWhere'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import { prisma } from '@/lib/prisma'

export type DashboardStatus = 'DRAFT' | 'IN_PROGRESS' | 'HALF_TIME' | 'COMPLETED'

export type DashboardWorkItem = {
  id: string
  href: string
  title: string
  subtitle: string
  meta: string
  status: string
}

export type DashboardParentSubmission = {
  id: string
  href: string
  title: string
  subtitle: string
  status: string
  createdAt: Date
}

export type DashboardData =
  | {
      kind: 'coach'
      contextLabel: string
      snapshot: {
        playersTracked: number
        completedMatches: number
        completedFitnessSessions: number
        pendingParentSubmissions: number
        activeWorkCount: number
      }
      attention: {
        pendingParentSubmissions: DashboardParentSubmission[]
        activeMatches: DashboardWorkItem[]
        activeFitnessSessions: DashboardWorkItem[]
      }
      recentReports: {
        matches: DashboardWorkItem[]
        fitnessSessions: DashboardWorkItem[]
      }
    }
  | {
      kind: 'parent'
      linkedPlayerCount: number
      liveMatchCount: number
      recentSubmissions: DashboardParentSubmission[]
    }
  | { kind: 'no_access' }

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

const thirtyDaysAgo = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [manageableTeamIds, recordableTeamIds, spectatorAccess] = await Promise.all([
    getManageableTeamIds(userId),
    getRecordableTeamIds(userId),
    prisma.spectatorAccess.findMany({
      where: { userId },
      select: { playerId: true },
    }),
  ])

  if (manageableTeamIds.length > 0) {
    return getCoachDashboardData(manageableTeamIds, 'Coach snapshot')
  }

  if (recordableTeamIds.length > 0) {
    return getCoachDashboardData(recordableTeamIds, 'Assigned team snapshot')
  }

  if (spectatorAccess.length > 0) {
    return getParentDashboardData(userId, spectatorAccess.map((access) => access.playerId))
  }

  return { kind: 'no_access' }
}

async function getCoachDashboardData(teamIds: string[], contextLabel: string): Promise<DashboardData> {
  const recentSince = thirtyDaysAgo()
  const teamWhere = { teamId: { in: teamIds } }

  const [
    playersTracked,
    completedMatches,
    completedFitnessSessions,
    pendingParentSubmissionCount,
    pendingParentSubmissions,
    activeMatches,
    activeFitnessSessions,
    latestCompletedMatches,
    latestCompletedFitnessSessions,
  ] = await Promise.all([
    prisma.player.count({ where: { ...teamWhere, isActive: true } }),
    prisma.matchDay.count({
      where: {
        ...teamWhere,
        status: 'COMPLETED',
        completedAt: { gte: recentSince },
      },
    }),
    prisma.fitnessTestSession.count({
      where: {
        ...teamWhere,
        status: 'COMPLETED',
        completedAt: { gte: recentSince },
      },
    }),
    prisma.submittedMatchEvent.count({
      where: {
        status: 'PENDING',
        matchDay: teamWhere,
      },
    }),
    prisma.submittedMatchEvent.findMany({
      where: {
        status: 'PENDING',
        matchDay: teamWhere,
      },
      include: {
        player: true,
        matchDay: { include: { team: { include: { club: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.matchDay.findMany({
      where: {
        ...teamWhere,
        status: { in: ['IN_PROGRESS', 'HALF_TIME'] },
      },
      include: { team: { include: { club: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.fitnessTestSession.findMany({
      where: {
        ...teamWhere,
        status: 'IN_PROGRESS',
      },
      include: {
        team: { include: { club: true } },
        fitnessTestType: true,
        _count: { select: { results: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.matchDay.findMany({
      where: {
        ...teamWhere,
        status: 'COMPLETED',
      },
      include: { team: { include: { club: true } } },
      orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
    }),
    prisma.fitnessTestSession.findMany({
      where: {
        ...teamWhere,
        status: 'COMPLETED',
      },
      include: {
        team: { include: { club: true } },
        fitnessTestType: true,
        _count: { select: { results: true } },
      },
      orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
    }),
  ])

  return {
    kind: 'coach',
    contextLabel,
    snapshot: {
      playersTracked,
      completedMatches,
      completedFitnessSessions,
      pendingParentSubmissions: pendingParentSubmissionCount,
      activeWorkCount: activeMatches.length + activeFitnessSessions.length,
    },
    attention: {
      pendingParentSubmissions: pendingParentSubmissions.map((submission) => ({
        id: submission.id,
        href: `/match-day/${submission.matchDayId}`,
        title: `${submission.player.firstName} ${submission.player.surname}`,
        subtitle: `${submission.matchDay.team.name} vs ${submission.matchDay.opposition}`,
        status: 'Needs review',
        createdAt: submission.createdAt,
      })),
      activeMatches: activeMatches.map((match) => ({
        id: match.id,
        href: `/match-day/${match.id}`,
        title: `${match.team.name} vs ${match.opposition}`,
        subtitle: match.team.club.name,
        meta: `${formatDate(match.kickoffAt)} · Score ${match.ownScore}-${match.oppositionScore}`,
        status: formatStatus(match.status),
      })),
      activeFitnessSessions: activeFitnessSessions.map((session) => ({
        id: session.id,
        href: getFitnessSessionHref(session),
        title: session.fitnessTestType.name,
        subtitle: `${session.team.club.name} / ${session.team.name}`,
        meta: `${formatDate(session.date)} · ${session._count.results} results`,
        status: formatStatus(session.status),
      })),
    },
    recentReports: {
      matches: latestCompletedMatches.map((match) => ({
        id: match.id,
        href: `/match-day/${match.id}`,
        title: `${match.team.name} vs ${match.opposition}`,
        subtitle: match.team.club.name,
        meta: `${formatDate(match.kickoffAt)} · Final ${match.ownScore}-${match.oppositionScore}`,
        status: 'Completed',
      })),
      fitnessSessions: latestCompletedFitnessSessions.map((session) => ({
        id: session.id,
        href: `/fitness/sessions/${session.id}`,
        title: session.fitnessTestType.name,
        subtitle: `${session.team.club.name} / ${session.team.name}`,
        meta: `${formatDate(session.date)} · ${session._count.results} results`,
        status: 'Completed',
      })),
    },
  }
}

async function getParentDashboardData(userId: string, linkedPlayerIds: string[]): Promise<DashboardData> {
  const [liveMatches, recentSubmissions] = await Promise.all([
    prisma.matchDay.findMany({
      where: {
        status: 'IN_PROGRESS',
        matchDayPlayers: {
          some: {
            playerId: { in: linkedPlayerIds },
            squadStatus: { not: 'NOT_INVOLVED' },
          },
        },
      },
      select: { id: true },
    }),
    prisma.submittedMatchEvent.findMany({
      where: { submittedByUserId: userId },
      include: {
        player: true,
        matchDay: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    kind: 'parent',
    linkedPlayerCount: linkedPlayerIds.length,
    liveMatchCount: liveMatches.length,
    recentSubmissions: recentSubmissions.map((submission) => ({
      id: submission.id,
      href: `/my-player/matches/${submission.matchDayId}`,
      title: `${submission.player.firstName} ${submission.player.surname}`,
      subtitle: `${submission.matchDay.team.name} vs ${submission.matchDay.opposition}`,
      status: formatStatus(submission.status),
      createdAt: submission.createdAt,
    })),
  }
}

function getFitnessSessionHref(session: {
  id: string
  fitnessTestType: {
    allowedRecordingModes: string
    preferredRecordingMode: string
  }
}) {
  const recordingModes = getFitnessRecordingModes(session.fitnessTestType)

  if (recordingModes.liveDropout) return `/fitness/sessions/${session.id}/live`
  if (recordingModes.liveTimedFinish) return `/fitness/sessions/${session.id}/timer`
  return `/fitness/sessions/${session.id}`
}
