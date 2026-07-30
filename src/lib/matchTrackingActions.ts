'use server'

import type { MatchTrackingScope } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth'
import {
  acceptDirectAssignment,
  archiveMatchTrackingTask,
  cancelContributorAssignment,
  claimGroupOffer,
  copyMatchTrackingTask,
  createDirectAssignment,
  createGroupOffer,
  createMatchTrackingTask,
  createSelfAssignment,
  declineDirectAssignment,
  declineGroupOffer,
  markContributorAssignmentSubmitted,
  markMatchTrackingTaskReady,
  setMatchTrackingTaskEvents,
  startContributorAssignment,
  updateMatchTrackingTask,
} from '@/lib/matchTrackingAssignments'
import { canManageMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { createAssignmentLinkedSubmission } from '@/lib/matchTrackingSubmissions'

export type MatchTrackingActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> }

const scopes = ['PLAYER', 'UNIT', 'TEAM'] as const satisfies MatchTrackingScope[]

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getOptionalText = (formData: FormData, key: string) => getText(formData, key) || null

const getSelectedIds = (formData: FormData, key: string) =>
  Array.from(new Set(formData.getAll(key).filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)))

const getOptionalCoordinate = (formData: FormData, key: string) => {
  const value = getText(formData, key)
  if (!value) return null
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate : null
}

const ok = <T>(data: T): MatchTrackingActionResult<T> => ({ ok: true, data })

const fail = (code: string, message: string, fieldErrors?: Record<string, string[]>): MatchTrackingActionResult<never> => ({ ok: false, code, message, fieldErrors })

const mapDomainFailure = (reason: string) => {
  if (reason.includes('permission') || reason.includes('cannot manage')) return fail('FORBIDDEN', reason)
  if (reason.includes('ready')) return fail('TASK_NOT_READY', reason)
  if (reason.includes('eligible')) return fail('CONTRIBUTOR_NOT_ELIGIBLE', reason)
  if (reason.includes('claimed') || reason.includes('already')) return fail('ASSIGNMENT_CONFLICT', reason)
  if (reason.includes('selected event') || reason.includes('same match')) return fail('EVENT_NOT_SELECTED', reason)
  if (reason.includes('squad') || reason.includes('player')) return fail('PLAYER_NOT_IN_SQUAD', reason)
  if (reason.includes('assignment') || reason.includes('Assignment')) return fail('INVALID_TRANSITION', reason)
  return fail('INVALID_INPUT', reason)
}

const revalidateTrackingPaths = async (matchDayId?: string | null) => {
  revalidatePath('/dev/match-tracking')
  revalidatePath('/')
  if (matchDayId) revalidatePath(`/match-day/${matchDayId}`)
}

async function getTaskMatchDayId(trackingTaskId: string) {
  const task = await prisma.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, select: { matchDayId: true } })
  return task?.matchDayId ?? null
}

async function getAssignmentMatchDayId(assignmentId: string) {
  const assignment = await prisma.matchContributorAssignment.findUnique({ where: { id: assignmentId }, select: { trackingTask: { select: { matchDayId: true } } } })
  return assignment?.trackingTask.matchDayId ?? null
}

function parseScope(formData: FormData): MatchTrackingActionResult<MatchTrackingScope> {
  const scopeType = getText(formData, 'scopeType')
  if (!scopes.includes(scopeType as MatchTrackingScope)) return fail('INVALID_INPUT', 'Tracking scope is invalid.', { scopeType: ['Choose a valid scope.'] })
  return ok(scopeType as MatchTrackingScope)
}

function getTaskInput(formData: FormData) {
  const scope = parseScope(formData)
  if (!scope.ok) return scope
  return ok({
    scopeType: scope.data,
    playerId: getOptionalText(formData, 'playerId'),
    unitKey: getOptionalText(formData, 'unitKey'),
    unitLabel: getOptionalText(formData, 'unitLabel'),
    title: getText(formData, 'title'),
    instructions: getOptionalText(formData, 'instructions'),
  })
}

export async function createTrackingTaskAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    const matchDayId = getText(formData, 'matchDayId')
    const input = getTaskInput(formData)
    if (!input.ok) return input
    const result = await createMatchTrackingTask({ ...input.data, matchDayId, createdByUserId: user.id })
    if (!result.ok) return mapDomainFailure(result.reason)
    await revalidateTrackingPaths(matchDayId)
    return ok(result.value)
  } catch (error) {
    console.error('Create tracking task failed.', error)
    return fail('UNEXPECTED_ERROR', 'Tracking task could not be created.')
  }
}

export async function updateTrackingTaskAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    const trackingTaskId = getText(formData, 'trackingTaskId')
    const input = getTaskInput(formData)
    if (!input.ok) return input
    const matchDayId = await getTaskMatchDayId(trackingTaskId)
    const result = await updateMatchTrackingTask({ ...input.data, trackingTaskId, actorUserId: user.id })
    if (!result.ok) return mapDomainFailure(result.reason)
    await revalidateTrackingPaths(matchDayId)
    return ok(result.value)
  } catch (error) {
    console.error('Update tracking task failed.', error)
    return fail('UNEXPECTED_ERROR', 'Tracking task could not be updated.')
  }
}

export async function setTrackingTaskEventsAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const trackingTaskId = getText(formData, 'trackingTaskId')
  const matchDayId = await getTaskMatchDayId(trackingTaskId)
  const result = await setMatchTrackingTaskEvents({ actorUserId: user.id, trackingTaskId, matchDayEventTypeIds: getSelectedIds(formData, 'matchDayEventTypeId') })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(undefined)
}

export async function markTrackingTaskReadyAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const trackingTaskId = getText(formData, 'trackingTaskId')
  const matchDayId = await getTaskMatchDayId(trackingTaskId)
  const result = await markMatchTrackingTaskReady({ actorUserId: user.id, trackingTaskId })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(undefined)
}

export async function archiveTrackingTaskAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const trackingTaskId = getText(formData, 'trackingTaskId')
  const matchDayId = await getTaskMatchDayId(trackingTaskId)
  const result = await archiveMatchTrackingTask({ actorUserId: user.id, trackingTaskId })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(undefined)
}

export async function copyTrackingTaskAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string; requiresPlayerSelection: boolean; missingEventIds: string[] }>> {
  const user = await getCurrentUser()
  const destinationMatchDayId = getText(formData, 'destinationMatchDayId')
  const result = await copyMatchTrackingTask({ actorUserId: user.id, sourceTaskId: getText(formData, 'sourceTaskId'), destinationMatchDayId, destinationPlayerId: getOptionalText(formData, 'destinationPlayerId') })
  if (!result.ok && result.missingEventIds) return fail('EVENT_NOT_SELECTED', result.reason, { missingEventIds: result.missingEventIds })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(destinationMatchDayId)
  return ok(result.value)
}

export async function createSelfAssignmentAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  const trackingTaskId = getText(formData, 'trackingTaskId')
  const matchDayId = await getTaskMatchDayId(trackingTaskId)
  const result = await createSelfAssignment({ actorUserId: user.id, trackingTaskId })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(result.value)
}

export async function createDirectAssignmentAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  const trackingTaskId = getText(formData, 'trackingTaskId')
  const matchDayId = await getTaskMatchDayId(trackingTaskId)
  const result = await createDirectAssignment({ actorUserId: user.id, trackingTaskId, assignedUserId: getText(formData, 'assignedUserId') })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(result.value)
}

export async function createGroupOfferAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  const trackingTaskId = getText(formData, 'trackingTaskId')
  const matchDayId = await getTaskMatchDayId(trackingTaskId)
  const result = await createGroupOffer({ actorUserId: user.id, trackingTaskId, recipientUserIds: getSelectedIds(formData, 'recipientUserId') })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(result.value)
}

export async function acceptDirectAssignmentAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await acceptDirectAssignment({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function declineDirectAssignmentAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await declineDirectAssignment({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function claimGroupOfferAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await claimGroupOffer({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function declineGroupOfferAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await declineGroupOffer({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function cancelAssignmentAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await cancelContributorAssignment({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function startAssignmentAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await startContributorAssignment({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function markAssignmentSubmittedAction(formData: FormData): Promise<MatchTrackingActionResult> {
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await markContributorAssignmentSubmitted({ assignmentId, actorUserId: user.id })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(await getAssignmentMatchDayId(assignmentId))
  return ok(undefined)
}

export async function createAssignmentLinkedSubmissionAction(formData: FormData): Promise<MatchTrackingActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  const matchDayId = getText(formData, 'matchDayId')
  const result = await createAssignmentLinkedSubmission({
    assignmentId: getText(formData, 'assignmentId'),
    actorUserId: user.id,
    matchDayId,
    playerId: getText(formData, 'playerId'),
    matchDayEventTypeId: getText(formData, 'matchDayEventTypeId'),
    note: getOptionalText(formData, 'note'),
    x: getOptionalCoordinate(formData, 'x'),
    y: getOptionalCoordinate(formData, 'y'),
  })
  if (!result.ok) return mapDomainFailure(result.reason)
  await revalidateTrackingPaths(matchDayId)
  return ok(result.value)
}

export async function ensureCanManageHarnessMatch(userId: string, matchDayId: string) {
  return canManageMatchDay(userId, matchDayId)
}
