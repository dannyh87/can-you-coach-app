import type { NotificationType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type Db = typeof prisma | Prisma.TransactionClient

type Result<T = unknown> = { ok: true; value: T } | { ok: false; reason: string }

const trackingSource = 'MATCH_DAY_TRACKING_V2'

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)

const formatScope = (scope: string) => scope.charAt(0) + scope.slice(1).toLowerCase()

const assignmentHref = (assignmentId: string) => `/my-assignments/${assignmentId}`

const matchHref = (matchDayId: string) => `/match-day/${matchDayId}`

export type CreateNotificationInput = {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  href?: string | null
  matchDayId?: string | null
  assignmentId?: string | null
  dedupeKey?: string | null
  source?: string
}

async function getAssignmentSummary(db: Db, assignmentId: string) {
  return db.matchContributorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      assignedUser: { select: { id: true } },
      assignedBy: { select: { id: true } },
      recipients: { select: { userId: true, declinedAt: true, closedAt: true } },
      trackingTask: {
        include: {
          player: { select: { firstName: true, surname: true } },
          events: { include: { matchDayEventType: { include: { eventDefinition: true } } } },
          patterns: { select: { id: true } },
          matchDay: { include: { team: { select: { name: true } } } },
        },
      },
    },
  })
}

function describeAssignment(assignment: NonNullable<Awaited<ReturnType<typeof getAssignmentSummary>>>) {
  const task = assignment.trackingTask
  const target = task.scopeType === 'PLAYER'
    ? task.player ? `${task.player.firstName} ${task.player.surname}` : 'the selected player'
    : task.scopeType === 'UNIT'
      ? task.unitLabel ?? 'the selected unit'
      : 'the whole team'
  const eventCount = task.events.length
  const patternCount = task.patterns?.length ?? 0
  const eventLabel = `${eventCount} event${eventCount === 1 ? '' : 's'}${patternCount > 0 ? ` and ${patternCount} tactical pattern${patternCount === 1 ? '' : 's'}` : ''}`

  return {
    href: assignmentHref(assignment.id),
    matchHref: matchHref(task.matchDayId),
    matchDayId: task.matchDayId,
    teamName: task.matchDay.team.name,
    opposition: task.matchDay.opposition,
    kickoff: formatDate(task.matchDay.kickoffAt),
    target,
    eventLabel,
    scopeLabel: formatScope(task.scopeType),
    title: task.title,
  }
}

export async function createNotification(input: CreateNotificationInput, db: Db = prisma): Promise<Result<{ id: string }>> {
  try {
    const data = {
      userId: input.userId,
      type: input.type,
      source: input.source ?? 'SYSTEM',
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      matchDayId: input.matchDayId ?? null,
      assignmentId: input.assignmentId ?? null,
      dedupeKey: input.dedupeKey ?? null,
    }

    if (data.dedupeKey) {
      const notification = await db.notification.upsert({
        where: { userId_dedupeKey: { userId: data.userId, dedupeKey: data.dedupeKey } },
        update: { ...data, archivedAt: null },
        create: data,
        select: { id: true },
      })
      return { ok: true, value: notification }
    }

    const notification = await db.notification.create({ data, select: { id: true } })
    return { ok: true, value: notification }
  } catch (error) {
    console.error('Notification creation failed.', error)
    return { ok: false, reason: 'Notification could not be created.' }
  }
}

export async function createNotificationsForUsers(inputs: CreateNotificationInput[], db: Db = prisma): Promise<Result<{ count: number }>> {
  for (const input of inputs) {
    const result = await createNotification(input, db)
    if (!result.ok) return result
  }
  return { ok: true, value: { count: inputs.length } }
}

export async function getUnreadNotificationCount(userId: string, db: Db = prisma) {
  return db.notification.count({ where: { userId, readAt: null, archivedAt: null } })
}

export async function getNotificationsForUser(userId: string, db: Db = prisma) {
  return db.notification.findMany({
    where: { userId, archivedAt: null },
    include: { assignment: { select: { id: true, status: true, assignmentMode: true, assignedUserId: true } }, matchDay: { select: { id: true, opposition: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getNotificationForUser(userId: string, notificationId: string, db: Db = prisma) {
  return db.notification.findFirst({
    where: { id: notificationId, userId, archivedAt: null },
    include: { assignment: true, matchDay: true },
  })
}

export async function markNotificationRead(userId: string, notificationId: string, db: Db = prisma): Promise<Result> {
  const updated = await db.notification.updateMany({ where: { id: notificationId, userId }, data: { readAt: new Date() } })
  return updated.count === 1 ? { ok: true, value: true } : { ok: false, reason: 'Notification was not found.' }
}

export async function markAllNotificationsRead(userId: string, db: Db = prisma): Promise<Result> {
  await db.notification.updateMany({ where: { userId, readAt: null, archivedAt: null }, data: { readAt: new Date() } })
  return { ok: true, value: true }
}

export async function archiveNotification(userId: string, notificationId: string, db: Db = prisma): Promise<Result> {
  const updated = await db.notification.updateMany({ where: { id: notificationId, userId }, data: { archivedAt: new Date() } })
  return updated.count === 1 ? { ok: true, value: true } : { ok: false, reason: 'Notification was not found.' }
}

export async function notifyDirectAssignmentCreated(db: Db, assignmentId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment?.assignedUserId) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  return createNotification({
    userId: assignment.assignedUserId,
    type: 'TRACKING_DIRECT_ASSIGNED',
    source: trackingSource,
    title: 'New Match Day assignment',
    body: `You have been asked to track ${summary.target} (${summary.eventLabel}) for ${summary.teamName} against ${summary.opposition}.`,
    href: summary.href,
    matchDayId: summary.matchDayId,
    assignmentId,
    dedupeKey: `tracking-assignment:${assignmentId}:assigned:${assignment.assignedUserId}`,
  }, db)
}

export async function notifyGroupOfferCreated(db: Db, assignmentId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  return createNotificationsForUsers(assignment.recipients.map((recipient) => ({
    userId: recipient.userId,
    type: 'TRACKING_GROUP_OFFERED' as const,
    source: trackingSource,
    title: 'Tracking help needed',
    body: `${summary.teamName} needs one person to track ${summary.target} (${summary.eventLabel}) against ${summary.opposition}.`,
    href: summary.href,
    matchDayId: summary.matchDayId,
    assignmentId,
    dedupeKey: `tracking-assignment:${assignmentId}:offered:${recipient.userId}`,
  })), db)
}

export async function notifyAssignmentAccepted(db: Db, assignmentId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment?.assignedUserId) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  return createNotification({
    userId: assignment.assignedByUserId,
    type: 'TRACKING_ASSIGNMENT_ACCEPTED',
    source: trackingSource,
    title: 'Assignment accepted',
    body: `${summary.target} tracking against ${summary.opposition} has been accepted.`,
    href: summary.matchHref,
    matchDayId: summary.matchDayId,
    assignmentId,
    dedupeKey: `tracking-assignment:${assignmentId}:accepted:${assignment.assignedByUserId}`,
  }, db)
}

export async function notifyAssignmentDeclined(db: Db, assignmentId: string, actorUserId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  return createNotification({
    userId: assignment.assignedByUserId,
    type: 'TRACKING_ASSIGNMENT_DECLINED',
    source: trackingSource,
    title: 'Assignment declined',
    body: `${summary.target} tracking against ${summary.opposition} was declined.`,
    href: summary.matchHref,
    matchDayId: summary.matchDayId,
    assignmentId,
    dedupeKey: `tracking-assignment:${assignmentId}:declined:${actorUserId}:${assignment.assignedByUserId}`,
  }, db)
}

export async function notifyGroupOfferClaimed(db: Db, assignmentId: string, claimantUserId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  const now = new Date()
  await db.notification.updateMany({
    where: { assignmentId, type: 'TRACKING_GROUP_OFFERED', userId: { not: claimantUserId }, archivedAt: null },
    data: { archivedAt: now, readAt: now },
  })
  const otherRecipients = assignment.recipients.filter((recipient) => recipient.userId !== claimantUserId).map((recipient) => recipient.userId)
  return createNotificationsForUsers([
    {
      userId: assignment.assignedByUserId,
      type: 'TRACKING_OFFER_CLAIMED' as const,
      source: trackingSource,
      title: 'Group offer claimed',
      body: `${summary.target} tracking against ${summary.opposition} has been accepted by a contributor.`,
      href: summary.matchHref,
      matchDayId: summary.matchDayId,
      assignmentId,
      dedupeKey: `tracking-assignment:${assignmentId}:claimed:${assignment.assignedByUserId}`,
    },
    ...otherRecipients.map((userId) => ({
      userId,
      type: 'TRACKING_OFFER_CLAIMED' as const,
      source: trackingSource,
      title: 'Tracking task already taken',
      body: `${summary.target} tracking against ${summary.opposition} has already been accepted by another contributor.`,
      href: summary.href,
      matchDayId: summary.matchDayId,
      assignmentId,
      dedupeKey: `tracking-assignment:${assignmentId}:claimed-other:${userId}`,
    })),
  ], db)
}

export async function notifyAssignmentCancelled(db: Db, assignmentId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  const recipientIds = assignment.assignedUserId ? [assignment.assignedUserId] : assignment.recipients.filter((recipient) => !recipient.closedAt && !recipient.declinedAt).map((recipient) => recipient.userId)
  await db.notification.updateMany({ where: { assignmentId, archivedAt: null, type: { in: ['TRACKING_DIRECT_ASSIGNED', 'TRACKING_GROUP_OFFERED'] } }, data: { archivedAt: new Date() } })
  return createNotificationsForUsers(recipientIds.map((userId) => ({
    userId,
    type: 'TRACKING_ASSIGNMENT_CANCELLED' as const,
    source: trackingSource,
    title: 'Assignment cancelled',
    body: `${summary.title} against ${summary.opposition} has been cancelled.`,
    href: summary.href,
    matchDayId: summary.matchDayId,
    assignmentId,
    dedupeKey: `tracking-assignment:${assignmentId}:cancelled:${userId}`,
  })), db)
}

export async function notifyAssignmentSubmitted(db: Db, assignmentId: string): Promise<Result> {
  const assignment = await getAssignmentSummary(db, assignmentId)
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const summary = describeAssignment(assignment)
  return createNotification({
    userId: assignment.assignedByUserId,
    type: 'TRACKING_SUBMISSION_RECEIVED',
    source: trackingSource,
    title: 'Match observations ready for review',
    body: `${summary.title} for ${summary.teamName} against ${summary.opposition} has been submitted to the coaching team.`,
    href: summary.matchHref,
    matchDayId: summary.matchDayId,
    assignmentId,
    dedupeKey: `tracking-assignment:${assignmentId}:submitted:${assignment.assignedByUserId}`,
  }, db)
}

export async function notifySubmissionReviewed(db: Db, submittedMatchEventId: string): Promise<Result> {
  const submission = await db.submittedMatchEvent.findUnique({ where: { id: submittedMatchEventId }, select: { id: true, submittedByUserId: true, status: true, assignmentId: true, matchDayId: true, matchDay: { select: { opposition: true } } } })
  if (!submission) return { ok: false, reason: 'Submission was not found.' }
  return createNotification({
    userId: submission.submittedByUserId,
    type: 'TRACKING_SUBMISSION_REVIEWED',
    source: trackingSource,
    title: 'Observation reviewed',
    body: `Your Match Day observation against ${submission.matchDay.opposition} was ${submission.status.toLowerCase()}.`,
    href: submission.assignmentId ? assignmentHref(submission.assignmentId) : `/my-player/matches/${submission.matchDayId}`,
    matchDayId: submission.matchDayId,
    assignmentId: submission.assignmentId,
    dedupeKey: `tracking-submission:${submission.id}:reviewed:${submission.submittedByUserId}`,
  }, db)
}
