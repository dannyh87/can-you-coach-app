import { prisma } from '@/lib/prisma'

export function formatAssignmentStatus(status: string) {
  return status.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ')
}

export function getAssignmentTarget(task: { scopeType: string; unitLabel: string | null; player: { firstName: string; surname: string } | null }) {
  if (task.scopeType === 'PLAYER') return task.player ? `${task.player.firstName} ${task.player.surname}` : 'Selected player'
  if (task.scopeType === 'UNIT') return task.unitLabel ?? 'Selected unit'
  return 'Whole team'
}

export function getAssignmentPrimaryAction(assignment: { assignmentMode: string; status: string; assignedUserId: string | null }, userId: string, matchStatus?: string) {
  if (assignment.assignmentMode === 'DIRECT' && assignment.status === 'PENDING' && assignment.assignedUserId === userId) return 'respond-direct'
  if (assignment.assignmentMode === 'GROUP_OFFER' && assignment.status === 'OFFERED') return 'respond-group'
  if (assignment.status === 'ACCEPTED') return matchStatus === 'IN_PROGRESS' ? 'start' : 'view'
  if (assignment.status === 'IN_PROGRESS') return 'continue'
  return 'view'
}

const assignmentInclude = {
  assignedBy: { select: { id: true } },
  assignedUser: { select: { id: true } },
  recipients: { select: { userId: true, declinedAt: true, closedAt: true } },
  submittedMatchEvents: { select: { id: true, status: true } },
  trackingTask: {
    include: {
      player: { select: { firstName: true, surname: true } },
      events: { include: { matchDayEventType: { include: { eventDefinition: true } } }, orderBy: { displayOrder: 'asc' as const } },
      matchDay: { include: { team: { include: { club: true } } } },
    },
  },
}

export async function getAssignmentsForUser(userId: string) {
  return prisma.matchContributorAssignment.findMany({
    where: { OR: [{ assignedUserId: userId }, { recipients: { some: { userId } } }] },
    include: assignmentInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getAssignmentForUser(userId: string, assignmentId: string) {
  return prisma.matchContributorAssignment.findFirst({
    where: { id: assignmentId, OR: [{ assignedUserId: userId }, { recipients: { some: { userId } } }] },
    include: assignmentInclude,
  })
}

export async function getAssignmentStatusForMatch(matchDayId: string) {
  return prisma.matchTrackingTask.findMany({
    where: { matchDayId, status: { not: 'ARCHIVED' } },
    include: {
      player: { select: { firstName: true, surname: true } },
      events: { select: { id: true } },
      assignments: {
        include: { assignedUser: { select: { id: true } }, recipients: { select: { id: true, declinedAt: true, closedAt: true } }, submittedMatchEvents: { select: { id: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}
