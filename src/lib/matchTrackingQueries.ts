import { getManageableTeamIds } from '@/lib/accessWhere'
import { getEligibleMatchContributors } from '@/lib/matchTrackingAssignments'
import { canManageMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export async function getMatchTrackingHarnessMatches(userId: string) {
  const manageableTeamIds = await getManageableTeamIds(userId)
  if (manageableTeamIds.length === 0) return []

  return prisma.matchDay.findMany({
    where: { teamId: { in: manageableTeamIds } },
    include: {
      team: { include: { club: true } },
      matchDayPlayers: { select: { id: true } },
      matchDayEventTypes: { select: { id: true } },
      matchTrackingTasks: { select: { id: true } },
    },
    orderBy: [{ status: 'asc' }, { kickoffAt: 'desc' }],
    take: 25,
  })
}

export async function getMatchTrackingHarnessData(userId: string, matchDayId: string) {
  if (!(await canManageMatchDay(userId, matchDayId))) return null

  return prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: {
      team: {
        include: {
          club: true,
          players: { where: { isActive: true }, orderBy: [{ surname: 'asc' }, { firstName: 'asc' }] },
        },
      },
      matchDayPlayers: {
        include: { player: true },
        orderBy: { createdAt: 'asc' },
      },
      matchDayEventTypes: {
        include: { eventDefinition: true },
        orderBy: { createdAt: 'asc' },
      },
      matchTrackingTasks: {
        include: {
          player: true,
          events: { include: { matchDayEventType: { include: { eventDefinition: true } } }, orderBy: { displayOrder: 'asc' } },
          assignments: {
            include: {
              assignedUser: { select: { id: true } },
              recipients: { include: { user: { select: { id: true } } } },
              submittedMatchEvents: { select: { id: true, status: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getEligibleContributorsForTask(trackingTaskId: string) {
  const task = await prisma.matchTrackingTask.findUnique({ where: { id: trackingTaskId } })
  if (!task) return []
  const result = await getEligibleMatchContributors({ matchDayId: task.matchDayId, scopeType: task.scopeType, playerId: task.playerId })
  return result.ok ? result.value : []
}

export async function getVisibleMatchAssignments(userId: string) {
  return prisma.matchContributorAssignment.findMany({
    where: {
      OR: [
        { assignedUserId: userId },
        { recipients: { some: { userId, declinedAt: null, closedAt: null } } },
      ],
    },
    include: { trackingTask: { include: { matchDay: { include: { team: true } } } }, recipients: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOpenGroupOffersForUser(userId: string) {
  return prisma.matchContributorAssignment.findMany({
    where: {
      assignmentMode: 'GROUP_OFFER',
      status: 'OFFERED',
      recipients: { some: { userId, declinedAt: null, closedAt: null } },
    },
    include: { trackingTask: { include: { matchDay: { include: { team: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPreviousTrackingTasksForCopy(userId: string, destinationMatchDayId: string) {
  const destinationMatch = await prisma.matchDay.findUnique({ where: { id: destinationMatchDayId }, select: { teamId: true } })
  if (!destinationMatch || !(await canManageMatchDay(userId, destinationMatchDayId))) return []

  return prisma.matchTrackingTask.findMany({
    where: { matchDay: { teamId: destinationMatch.teamId }, matchDayId: { not: destinationMatchDayId }, status: { not: 'ARCHIVED' } },
    include: { matchDay: true, events: { include: { matchDayEventType: { include: { eventDefinition: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}
