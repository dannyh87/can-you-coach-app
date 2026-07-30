'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { acceptDirectAssignment, claimGroupOffer, declineDirectAssignment, declineGroupOffer, markContributorAssignmentSubmitted, startContributorAssignment } from '@/lib/matchTrackingAssignments'
import { createAssignmentLinkedSubmission } from '@/lib/matchTrackingSubmissions'
import { prisma } from '@/lib/prisma'

type ActionResult = { ok: true } | { ok: false; reason: string }

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getOptionalNumber = (formData: FormData, key: string) => {
  const value = formData.get(key)
  if (typeof value !== 'string' || !value.trim()) return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : Number.NaN
}

const redirectBack = (assignmentId: string, result: { ok: true } | { ok: false; reason: string }) => {
  revalidatePath('/my-assignments')
  revalidatePath(`/my-assignments/${assignmentId}`)
  revalidatePath('/notifications')
  const params = new URLSearchParams()
  params.set(result.ok ? 'success' : 'error', result.ok ? 'Assignment updated.' : getFriendlyAssignmentError(result.reason))
  redirect(`/my-assignments/${assignmentId}?${params.toString()}`)
}

function getFriendlyAssignmentError(reason: string) {
  if (reason.includes('claimed') || reason.includes('recipient')) return 'This tracking task has already been accepted by another contributor.'
  if (reason.includes('another user')) return 'This assignment is not available to your account.'
  if (reason.includes('Cancelled')) return 'This assignment has been cancelled.'
  return reason
}

export async function acceptDirectAssignmentForCurrentUserAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) redirect('/')
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  redirectBack(assignmentId, await acceptDirectAssignment({ assignmentId, actorUserId: user.id }))
}

export async function declineDirectAssignmentForCurrentUserAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) redirect('/')
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  redirectBack(assignmentId, await declineDirectAssignment({ assignmentId, actorUserId: user.id }))
}

export async function claimGroupOfferForCurrentUserAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) redirect('/')
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  redirectBack(assignmentId, await claimGroupOffer({ assignmentId, actorUserId: user.id }))
}

export async function declineGroupOfferForCurrentUserAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) redirect('/')
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  redirectBack(assignmentId, await declineGroupOffer({ assignmentId, actorUserId: user.id }))
}

export async function startAssignmentForCurrentUserAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) redirect('/')
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await startContributorAssignment({ assignmentId, actorUserId: user.id })
  revalidatePath('/my-assignments')
  revalidatePath(`/my-assignments/${assignmentId}`)
  if (result.ok) redirect(`/my-assignments/${assignmentId}/track`)
  redirectBack(assignmentId, result)
}

export async function recordAssignmentObservationAction(formData: FormData): Promise<ActionResult> {
  if (!isMatchDayTrackingV2Enabled()) return { ok: false, reason: 'Match Day tracking is not available.' }
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const matchDayId = getText(formData, 'matchDayId')
  const matchDayEventTypeId = getText(formData, 'matchDayEventTypeId')
  const playerId = getText(formData, 'playerId') || null
  const note = getText(formData, 'note')
  const x = getOptionalNumber(formData, 'x')
  const y = getOptionalNumber(formData, 'y')
  if (Number.isNaN(x) || Number.isNaN(y)) return { ok: false, reason: 'Pitch location must be valid.' }

  const result = await createAssignmentLinkedSubmission({ assignmentId, actorUserId: user.id, matchDayId, playerId, matchDayEventTypeId, note, x, y })
  revalidatePath(`/my-assignments/${assignmentId}`)
  revalidatePath(`/my-assignments/${assignmentId}/track`)
  if (result.ok) revalidatePath(`/match-day/${matchDayId}`)
  return result.ok ? { ok: true } : { ok: false, reason: result.reason }
}

export async function undoAssignmentObservationAction(formData: FormData): Promise<ActionResult> {
  if (!isMatchDayTrackingV2Enabled()) return { ok: false, reason: 'Match Day tracking is not available.' }
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const submittedEventId = getText(formData, 'submittedEventId')
  const submittedEvent = await prisma.submittedMatchEvent.findFirst({
    where: { id: submittedEventId, assignmentId, submittedByUserId: user.id, status: 'PENDING' },
    select: { id: true, matchDayId: true },
  })
  if (!submittedEvent) return { ok: false, reason: 'Pending observation was not found.' }
  await prisma.submittedMatchEvent.delete({ where: { id: submittedEvent.id } })
  revalidatePath(`/my-assignments/${assignmentId}`)
  revalidatePath(`/my-assignments/${assignmentId}/track`)
  revalidatePath(`/match-day/${submittedEvent.matchDayId}`)
  return { ok: true }
}

export async function finishAssignmentTrackingAction(formData: FormData): Promise<ActionResult> {
  if (!isMatchDayTrackingV2Enabled()) return { ok: false, reason: 'Match Day tracking is not available.' }
  const user = await getCurrentUser()
  const assignmentId = getText(formData, 'assignmentId')
  const result = await markContributorAssignmentSubmitted({ assignmentId, actorUserId: user.id })
  const assignment = await prisma.matchContributorAssignment.findUnique({ where: { id: assignmentId }, select: { trackingTask: { select: { matchDayId: true } } } })
  revalidatePath('/my-assignments')
  revalidatePath(`/my-assignments/${assignmentId}`)
  revalidatePath(`/my-assignments/${assignmentId}/track`)
  if (assignment) revalidatePath(`/match-day/${assignment.trackingTask.matchDayId}`)
  return result.ok ? { ok: true } : { ok: false, reason: result.reason }
}
