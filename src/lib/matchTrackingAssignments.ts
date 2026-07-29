import type {
  MatchContributorAssignmentMode,
  MatchContributorAssignmentStatus,
  MatchTrackingScope,
  MatchTrackingTaskStatus,
} from '@prisma/client'

import { canManageMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Result<T = true> = { ok: true; value: T } | { ok: false; reason: string }

type Db = typeof prisma

type TaskScopeInput = {
  scopeType: MatchTrackingScope
  playerId?: string | null
  unitKey?: string | null
  unitLabel?: string | null
}

type TaskRecord = TaskScopeInput & {
  id: string
  matchDayId: string
  status: MatchTrackingTaskStatus
  events?: unknown[]
}

type AssignmentRecord = {
  id: string
  trackingTaskId: string
  assignmentMode: MatchContributorAssignmentMode
  status: MatchContributorAssignmentStatus
  assignedUserId: string | null
}

type Contributor = {
  userId: string
  kind: 'STAFF' | 'SPECTATOR'
  playerIds: string[]
  roles: string[]
}

const activeAssignmentStatuses: MatchContributorAssignmentStatus[] = ['PENDING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS']

const normalizeOptionalText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export function validateTrackingTaskScope(input: TaskScopeInput, { requireCompletePlayer = false } = {}): Result {
  if (input.scopeType === 'PLAYER') {
    if (requireCompletePlayer && !input.playerId) return { ok: false, reason: 'Player tracking tasks require a player before they can be readied.' }
    if (input.unitKey || input.unitLabel) return { ok: false, reason: 'Player tracking tasks cannot use unit fields.' }
    return { ok: true, value: true }
  }

  if (input.scopeType === 'UNIT') {
    if (input.playerId) return { ok: false, reason: 'Unit tracking tasks cannot use a player.' }
    if (!input.unitKey || !input.unitLabel) return { ok: false, reason: 'Unit tracking tasks require a unit key and label.' }
    return { ok: true, value: true }
  }

  if (input.playerId || input.unitKey || input.unitLabel) return { ok: false, reason: 'Team tracking tasks cannot use player or unit fields.' }
  return { ok: true, value: true }
}

export function validateAssignmentTransition({
  assignment,
  action,
  actorUserId,
}: {
  assignment: AssignmentRecord
  action: 'accept' | 'decline' | 'start' | 'submit' | 'cancel'
  actorUserId: string
}): Result {
  if (action !== 'cancel' && assignment.assignedUserId !== actorUserId) return { ok: false, reason: 'This assignment belongs to another user.' }
  if (assignment.status === 'CANCELLED') return { ok: false, reason: 'Cancelled assignments cannot be changed.' }
  if (assignment.status === 'SUBMITTED') return { ok: false, reason: 'Submitted assignments cannot be changed.' }

  if (action === 'accept') return assignment.status === 'PENDING' ? { ok: true, value: true } : { ok: false, reason: 'Only pending direct assignments can be accepted.' }
  if (action === 'decline') return assignment.status === 'PENDING' ? { ok: true, value: true } : { ok: false, reason: 'Only pending direct assignments can be declined.' }
  if (action === 'start') return assignment.status === 'ACCEPTED' ? { ok: true, value: true } : { ok: false, reason: 'Only accepted assignments can be started.' }
  if (action === 'submit') return assignment.status === 'IN_PROGRESS' ? { ok: true, value: true } : { ok: false, reason: 'Only in-progress assignments can be submitted.' }
  return { ok: true, value: true }
}

async function userCanManageMatch(db: Db, userId: string, matchDayId: string) {
  if (db === prisma) return canManageMatchDay(userId, matchDayId)
  return true
}

async function getMatchTeam(db: Db, matchDayId: string) {
  return db.matchDay.findUnique({ where: { id: matchDayId }, select: { id: true, teamId: true, team: { select: { clubId: true } } } })
}

async function validatePlayerForReady(db: Db, matchDayId: string, playerId: string): Promise<Result> {
  const match = await getMatchTeam(db, matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  const matchPlayer = await db.matchDayPlayer.findFirst({ where: { matchDayId, playerId, player: { teamId: match.teamId }, squadStatus: { not: 'NOT_INVOLVED' } }, select: { id: true } })
  if (!matchPlayer) return { ok: false, reason: 'Player must belong to the match team and be in the match squad.' }
  return { ok: true, value: true }
}

async function validateTaskCanBeReady(db: Db, task: TaskRecord): Promise<Result> {
  const scope = validateTrackingTaskScope(task, { requireCompletePlayer: true })
  if (!scope.ok) return scope
  if (task.scopeType === 'PLAYER' && task.playerId) {
    const player = await validatePlayerForReady(db, task.matchDayId, task.playerId)
    if (!player.ok) return player
  }
  const eventCount = task.events?.length ?? await db.matchTrackingTaskEvent.count({ where: { trackingTaskId: task.id } })
  if (eventCount === 0) return { ok: false, reason: 'Tracking tasks require at least one selected event before they can be readied.' }
  return { ok: true, value: true }
}

async function getReadyTaskForAssignment(db: Db, trackingTaskId: string): Promise<Result<TaskRecord>> {
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, include: { events: true } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  if (task.status !== 'READY') return { ok: false, reason: 'Tracking task must be ready before assignment.' }
  const ready = await validateTaskCanBeReady(db, task)
  if (!ready.ok) return ready
  return { ok: true, value: task }
}

async function assertCanManageTask(db: Db, actorUserId: string, matchDayId: string): Promise<Result> {
  if (!(await userCanManageMatch(db, actorUserId, matchDayId))) return { ok: false, reason: 'You cannot manage tracking tasks for this match.' }
  return { ok: true, value: true }
}

export async function createMatchTrackingTask(input: TaskScopeInput & { matchDayId: string; createdByUserId: string; title: string; instructions?: string | null; db?: Db }): Promise<Result<{ id: string }>> {
  const db = input.db ?? prisma
  const permission = await assertCanManageTask(db, input.createdByUserId, input.matchDayId)
  if (!permission.ok) return permission
  const scope = validateTrackingTaskScope(input)
  if (!scope.ok) return scope
  const title = input.title.trim()
  if (!title) return { ok: false, reason: 'Tracking task title is required.' }
  const task = await db.matchTrackingTask.create({ data: { matchDayId: input.matchDayId, createdByUserId: input.createdByUserId, scopeType: input.scopeType, playerId: input.playerId ?? null, unitKey: normalizeOptionalText(input.unitKey), unitLabel: normalizeOptionalText(input.unitLabel), title, instructions: normalizeOptionalText(input.instructions), status: 'DRAFT' }, select: { id: true } })
  return { ok: true, value: task }
}

export async function setMatchTrackingTaskEvents({ db = prisma, actorUserId, trackingTaskId, matchDayEventTypeIds }: { db?: Db; actorUserId: string; trackingTaskId: string; matchDayEventTypeIds: string[] }): Promise<Result> {
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, select: { id: true, matchDayId: true, status: true } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  const permission = await assertCanManageTask(db, actorUserId, task.matchDayId)
  if (!permission.ok) return permission
  if (task.status === 'ARCHIVED') return { ok: false, reason: 'Archived tasks cannot be changed.' }
  const eventIds = Array.from(new Set(matchDayEventTypeIds.filter(Boolean)))
  if (eventIds.length !== matchDayEventTypeIds.filter(Boolean).length) return { ok: false, reason: 'Duplicate task events are not allowed.' }
  if (eventIds.length === 0) return { ok: false, reason: 'Select at least one event for this tracking task.' }
  const selectedEvents = await db.matchDayEventType.findMany({ where: { id: { in: eventIds } }, select: { id: true, matchDayId: true } })
  if (selectedEvents.length !== eventIds.length || selectedEvents.some((event) => event.matchDayId !== task.matchDayId)) return { ok: false, reason: 'Task events must be selected for the same match.' }
  await db.$transaction([db.matchTrackingTaskEvent.deleteMany({ where: { trackingTaskId } }), ...eventIds.map((id, index) => db.matchTrackingTaskEvent.create({ data: { trackingTaskId, matchDayEventTypeId: id, displayOrder: index } }))])
  return { ok: true, value: true }
}

export async function markMatchTrackingTaskReady({ db = prisma, actorUserId, trackingTaskId }: { db?: Db; actorUserId: string; trackingTaskId: string }): Promise<Result> {
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, include: { events: true } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  const permission = await assertCanManageTask(db, actorUserId, task.matchDayId)
  if (!permission.ok) return permission
  const ready = await validateTaskCanBeReady(db, task)
  if (!ready.ok) return ready
  await db.matchTrackingTask.update({ where: { id: task.id }, data: { status: 'READY' } })
  return { ok: true, value: true }
}

export async function archiveMatchTrackingTask({ db = prisma, actorUserId, trackingTaskId }: { db?: Db; actorUserId: string; trackingTaskId: string }): Promise<Result> {
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, select: { id: true, matchDayId: true } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  const permission = await assertCanManageTask(db, actorUserId, task.matchDayId)
  if (!permission.ok) return permission
  await db.matchTrackingTask.update({ where: { id: trackingTaskId }, data: { status: 'ARCHIVED' } })
  return { ok: true, value: true }
}

export async function getEligibleMatchContributors({ db = prisma, matchDayId, scopeType, playerId }: { db?: Db; matchDayId: string; scopeType: MatchTrackingScope; playerId?: string | null }): Promise<Result<Contributor[]>> {
  const match = await db.matchDay.findUnique({ where: { id: matchDayId }, include: { team: { include: { club: { include: { memberships: { include: { teamAssignments: true, user: true } }, spectators: { include: { user: true, player: true } } } } } } } })
  if (!match) return { ok: false, reason: 'Match was not found.' }
  const contributors = new Map<string, Contributor>()
  for (const membership of match.team.club.memberships) {
    const isOwner = membership.role === 'OWNER'
    const isAssignedStaff = (membership.role === 'COACH' || membership.role === 'ASSISTANT_COACH') && membership.teamAssignments.some((assignment) => assignment.teamId === match.teamId)
    if (!isOwner && !isAssignedStaff) continue
    contributors.set(membership.userId, { userId: membership.userId, kind: 'STAFF', playerIds: [], roles: [membership.role] })
  }
  for (const access of match.team.club.spectators) {
    if (access.player.teamId !== match.teamId) continue
    if (scopeType === 'PLAYER' && access.playerId !== playerId) continue
    const existing = contributors.get(access.userId)
    if (existing) existing.playerIds.push(access.playerId)
    else contributors.set(access.userId, { userId: access.userId, kind: 'SPECTATOR', playerIds: [access.playerId], roles: [] })
  }
  return { ok: true, value: Array.from(contributors.values()) }
}

async function ensureEligible(db: Db, task: TaskRecord, userIds: string[]): Promise<Result> {
  const eligibility = await getEligibleMatchContributors({ db, matchDayId: task.matchDayId, scopeType: task.scopeType, playerId: task.playerId })
  if (!eligibility.ok) return eligibility
  const eligibleIds = new Set(eligibility.value.map((contributor) => contributor.userId))
  const invalidId = userIds.find((userId) => !eligibleIds.has(userId))
  if (invalidId) return { ok: false, reason: 'Contributor is not eligible for this tracking task.' }
  return { ok: true, value: true }
}

async function hasActiveDuplicate(db: Db, trackingTaskId: string, assignedUserId: string) {
  return db.matchContributorAssignment.findFirst({ where: { trackingTaskId, assignedUserId, status: { in: activeAssignmentStatuses } }, select: { id: true } })
}

export async function createSelfAssignment({ db = prisma, actorUserId, trackingTaskId }: { db?: Db; actorUserId: string; trackingTaskId: string }): Promise<Result<{ id: string }>> {
  const task = await getReadyTaskForAssignment(db, trackingTaskId)
  if (!task.ok) return task
  const permission = await assertCanManageTask(db, actorUserId, task.value.matchDayId)
  if (!permission.ok) return permission
  const eligible = await ensureEligible(db, task.value, [actorUserId])
  if (!eligible.ok) return eligible
  if (await hasActiveDuplicate(db, trackingTaskId, actorUserId)) return { ok: false, reason: 'This contributor already has an active assignment for this task.' }
  const now = new Date()
  const assignment = await db.matchContributorAssignment.create({ data: { trackingTaskId, assignmentMode: 'SELF', status: 'ACCEPTED', assignedUserId: actorUserId, assignedByUserId: actorUserId, acceptedAt: now }, select: { id: true } })
  return { ok: true, value: assignment }
}

export async function createDirectAssignment({ db = prisma, actorUserId, trackingTaskId, assignedUserId }: { db?: Db; actorUserId: string; trackingTaskId: string; assignedUserId: string }): Promise<Result<{ id: string }>> {
  const task = await getReadyTaskForAssignment(db, trackingTaskId)
  if (!task.ok) return task
  const permission = await assertCanManageTask(db, actorUserId, task.value.matchDayId)
  if (!permission.ok) return permission
  const eligible = await ensureEligible(db, task.value, [assignedUserId])
  if (!eligible.ok) return eligible
  if (await hasActiveDuplicate(db, trackingTaskId, assignedUserId)) return { ok: false, reason: 'This contributor already has an active assignment for this task.' }
  const assignment = await db.matchContributorAssignment.create({ data: { trackingTaskId, assignmentMode: 'DIRECT', status: 'PENDING', assignedUserId, assignedByUserId: actorUserId }, select: { id: true } })
  return { ok: true, value: assignment }
}

export async function createGroupOffer({ db = prisma, actorUserId, trackingTaskId, recipientUserIds }: { db?: Db; actorUserId: string; trackingTaskId: string; recipientUserIds: string[] }): Promise<Result<{ id: string }>> {
  const task = await getReadyTaskForAssignment(db, trackingTaskId)
  if (!task.ok) return task
  const permission = await assertCanManageTask(db, actorUserId, task.value.matchDayId)
  if (!permission.ok) return permission
  const userIds = Array.from(new Set(recipientUserIds.filter(Boolean)))
  if (userIds.length === 0) return { ok: false, reason: 'Select at least one group offer recipient.' }
  const eligible = await ensureEligible(db, task.value, userIds)
  if (!eligible.ok) return eligible
  const assignment = await db.$transaction(async (tx) => {
    const created = await tx.matchContributorAssignment.create({ data: { trackingTaskId, assignmentMode: 'GROUP_OFFER', status: 'OFFERED', assignedByUserId: actorUserId }, select: { id: true } })
    await tx.matchContributorAssignmentRecipient.createMany({ data: userIds.map((userId) => ({ assignmentId: created.id, userId })), skipDuplicates: true })
    return created
  })
  return { ok: true, value: assignment }
}

async function updateAssignmentStatus({ db, assignmentId, actorUserId, action, data }: { db: Db; assignmentId: string; actorUserId: string; action: 'accept' | 'decline' | 'start' | 'submit' | 'cancel'; data: Record<string, unknown> }): Promise<Result> {
  const assignment = await db.matchContributorAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, trackingTaskId: true, assignmentMode: true, status: true, assignedUserId: true } })
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const transition = validateAssignmentTransition({ assignment, action, actorUserId })
  if (!transition.ok) return transition
  await db.matchContributorAssignment.update({ where: { id: assignmentId }, data })
  return { ok: true, value: true }
}

export const acceptDirectAssignment = (input: { db?: Db; assignmentId: string; actorUserId: string }) => updateAssignmentStatus({ db: input.db ?? prisma, assignmentId: input.assignmentId, actorUserId: input.actorUserId, action: 'accept', data: { status: 'ACCEPTED', acceptedAt: new Date() } })
export const declineDirectAssignment = (input: { db?: Db; assignmentId: string; actorUserId: string }) => updateAssignmentStatus({ db: input.db ?? prisma, assignmentId: input.assignmentId, actorUserId: input.actorUserId, action: 'decline', data: { status: 'DECLINED', declinedAt: new Date() } })
export const startContributorAssignment = (input: { db?: Db; assignmentId: string; actorUserId: string }) => updateAssignmentStatus({ db: input.db ?? prisma, assignmentId: input.assignmentId, actorUserId: input.actorUserId, action: 'start', data: { status: 'IN_PROGRESS', startedAt: new Date() } })
export const markContributorAssignmentSubmitted = (input: { db?: Db; assignmentId: string; actorUserId: string }) => updateAssignmentStatus({ db: input.db ?? prisma, assignmentId: input.assignmentId, actorUserId: input.actorUserId, action: 'submit', data: { status: 'SUBMITTED', submittedAt: new Date() } })

export async function cancelContributorAssignment({ db = prisma, actorUserId, assignmentId }: { db?: Db; actorUserId: string; assignmentId: string }): Promise<Result> {
  const assignment = await db.matchContributorAssignment.findUnique({ where: { id: assignmentId }, include: { trackingTask: true } })
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  const permission = await assertCanManageTask(db, actorUserId, assignment.trackingTask.matchDayId)
  if (!permission.ok) return permission
  if (assignment.status === 'SUBMITTED') return { ok: false, reason: 'Submitted assignments cannot be cancelled.' }
  await db.matchContributorAssignment.update({ where: { id: assignmentId }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
  return { ok: true, value: true }
}

export async function claimGroupOffer({ db = prisma, assignmentId, actorUserId }: { db?: Db; assignmentId: string; actorUserId: string }): Promise<Result> {
  const recipient = await db.matchContributorAssignmentRecipient.findFirst({ where: { assignmentId, userId: actorUserId, declinedAt: null, closedAt: null }, select: { id: true } })
  if (!recipient) return { ok: false, reason: 'You are not an open recipient for this offer.' }
  const now = new Date()
  return db.$transaction(async (tx) => {
    const claimed = await tx.matchContributorAssignment.updateMany({ where: { id: assignmentId, assignmentMode: 'GROUP_OFFER', status: 'OFFERED', assignedUserId: null }, data: { status: 'ACCEPTED', assignedUserId: actorUserId, acceptedAt: now } })
    if (claimed.count !== 1) return { ok: false as const, reason: 'This group offer has already been claimed or closed.' }
    await tx.matchContributorAssignmentRecipient.updateMany({ where: { assignmentId, userId: { not: actorUserId }, closedAt: null }, data: { closedAt: now } })
    return { ok: true as const, value: true }
  })
}

export async function declineGroupOffer({ db = prisma, assignmentId, actorUserId }: { db?: Db; assignmentId: string; actorUserId: string }): Promise<Result> {
  const updated = await db.matchContributorAssignmentRecipient.updateMany({ where: { assignmentId, userId: actorUserId, declinedAt: null, closedAt: null, assignment: { status: 'OFFERED' } }, data: { declinedAt: new Date() } })
  return updated.count === 1 ? { ok: true, value: true } : { ok: false, reason: 'This group offer cannot be declined.' }
}

export async function copyMatchTrackingTask({ db = prisma, actorUserId, sourceTaskId, destinationMatchDayId, destinationPlayerId }: { db?: Db; actorUserId: string; sourceTaskId: string; destinationMatchDayId: string; destinationPlayerId?: string | null }): Promise<Result<{ id: string; requiresPlayerSelection: boolean; missingEventIds: string[] }>> {
  const sourceTask = await db.matchTrackingTask.findUnique({ where: { id: sourceTaskId }, include: { events: { include: { matchDayEventType: true }, orderBy: { displayOrder: 'asc' } } } })
  if (!sourceTask) return { ok: false, reason: 'Source tracking task was not found.' }
  const permission = await assertCanManageTask(db, actorUserId, destinationMatchDayId)
  if (!permission.ok) return permission
  let playerId = null as string | null
  let requiresPlayerSelection = false
  if (sourceTask.scopeType === 'PLAYER') {
    if (destinationPlayerId) {
      const player = await validatePlayerForReady(db, destinationMatchDayId, destinationPlayerId)
      if (!player.ok) return player
      playerId = destinationPlayerId
    } else {
      requiresPlayerSelection = true
    }
  }
  const destinationEvents = await db.matchDayEventType.findMany({ where: { matchDayId: destinationMatchDayId }, select: { id: true, eventDefinitionId: true, eventType: true } })
  const mappedEvents = sourceTask.events.map((event) => {
    const source = event.matchDayEventType
    return destinationEvents.find((destination) => source.eventDefinitionId ? destination.eventDefinitionId === source.eventDefinitionId : destination.eventType === source.eventType) ?? null
  })
  const missingEventIds = sourceTask.events.filter((_, index) => !mappedEvents[index]).map((event) => event.matchDayEventTypeId)
  if (missingEventIds.length > 0) return { ok: false, reason: 'One or more task events are not selected for the destination match.' }
  const created = await db.$transaction(async (tx) => {
    const task = await tx.matchTrackingTask.create({ data: { matchDayId: destinationMatchDayId, createdByUserId: actorUserId, scopeType: sourceTask.scopeType, playerId, unitKey: sourceTask.unitKey, unitLabel: sourceTask.unitLabel, title: sourceTask.title, instructions: sourceTask.instructions, sourceTaskId: sourceTask.id, status: 'DRAFT' }, select: { id: true } })
    await tx.matchTrackingTaskEvent.createMany({ data: mappedEvents.map((event, index) => ({ trackingTaskId: task.id, matchDayEventTypeId: event!.id, displayOrder: index })) })
    return task
  })
  return { ok: true, value: { id: created.id, requiresPlayerSelection, missingEventIds: [] } }
}
