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
  submittedPatterns: { select: { id: true, status: true } },
  trackingTask: {
    include: {
      player: { select: { firstName: true, surname: true } },
      events: { include: { matchDayEventType: { include: { eventDefinition: true } } }, orderBy: { displayOrder: 'asc' as const } },
      patterns: { include: { pattern: { include: { outcomes: { orderBy: { displayOrder: 'asc' as const } }, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' as const } } } } }, orderBy: { displayOrder: 'asc' as const } },
      clubDefinitions: { include: { clubTrackingDefinition: { include: { mappedEventDefinition: true, mappedPatternDefinition: { include: { outcomes: { orderBy: { displayOrder: 'asc' as const } }, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' as const } } } } } }, standardEventDefinitionAtSelection: true, standardPatternDefinitionAtSelection: { include: { outcomes: { orderBy: { displayOrder: 'asc' as const } }, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' as const } } } } }, orderBy: { displayOrder: 'asc' as const } },
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
      patterns: { select: { id: true } },
      assignments: {
        include: {
          assignedUser: { select: { id: true, email: true } },
          recipients: { select: { id: true, declinedAt: true, closedAt: true } },
          submittedMatchEvents: { select: { id: true, status: true } },
          submittedPatterns: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTrackableAssignmentForUser(userId: string, assignmentId: string) {
  const assignment = await prisma.matchContributorAssignment.findFirst({
    where: {
      id: assignmentId,
      assignedUserId: userId,
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      trackingTask: { status: 'READY' },
    },
    include: {
      submittedMatchEvents: {
        where: { submittedByUserId: userId },
        include: { eventDefinition: true, clubTrackingDefinition: true, standardEventDefinitionAtRecording: true, player: { select: { firstName: true, surname: true, squadNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      submittedPatterns: {
        where: { submittedByUserId: userId },
        include: { pattern: true, outcome: true, clubTrackingDefinition: true, standardPatternDefinitionAtRecording: true, player: { select: { firstName: true, surname: true, squadNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      trackingTask: {
        include: {
          player: { select: { id: true, firstName: true, surname: true, squadNumber: true } },
          events: { include: { matchDayEventType: { include: { eventDefinition: true } } }, orderBy: { displayOrder: 'asc' as const } },
          patterns: { include: { pattern: { include: { outcomes: { orderBy: { displayOrder: 'asc' as const } }, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' as const } } } } }, orderBy: { displayOrder: 'asc' as const } },
          clubDefinitions: { include: { clubTrackingDefinition: { include: { mappedEventDefinition: true, mappedPatternDefinition: { include: { outcomes: { orderBy: { displayOrder: 'asc' as const } }, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' as const } } } } } }, standardEventDefinitionAtSelection: true, standardPatternDefinitionAtSelection: { include: { outcomes: { orderBy: { displayOrder: 'asc' as const } }, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' as const } } } } }, orderBy: { displayOrder: 'asc' as const } },
          matchDay: { include: { team: { include: { club: true } } } },
        },
      },
    },
  })
  if (!assignment) return null

  const playerOnPitch = assignment.trackingTask.scopeType === 'PLAYER' && assignment.trackingTask.playerId
    ? Boolean(await prisma.matchPlayerStint.findFirst({ where: { matchDayId: assignment.trackingTask.matchDayId, playerId: assignment.trackingTask.playerId, endedAt: null }, select: { id: true } }))
    : null
  const playerInSquad = assignment.trackingTask.scopeType === 'PLAYER' && assignment.trackingTask.playerId
    ? Boolean(await prisma.matchDayPlayer.findFirst({ where: { matchDayId: assignment.trackingTask.matchDayId, playerId: assignment.trackingTask.playerId, squadStatus: { not: 'NOT_INVOLVED' } }, select: { id: true } }))
    : null
  const [pendingEventObservationCount, pendingPatternObservationCount] = await Promise.all([
    prisma.submittedMatchEvent.count({ where: { assignmentId: assignment.id, submittedByUserId: userId, status: 'PENDING' } }),
    prisma.submittedTrackingPatternObservation.count({ where: { assignmentId: assignment.id, submittedByUserId: userId, status: 'PENDING' } }),
  ])
  const pendingObservationCount = pendingEventObservationCount + pendingPatternObservationCount

  return { ...assignment, playerOnPitch, playerInSquad, pendingObservationCount }
}
