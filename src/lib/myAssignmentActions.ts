'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { acceptDirectAssignment, claimGroupOffer, declineDirectAssignment, declineGroupOffer, startContributorAssignment } from '@/lib/matchTrackingAssignments'

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
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
  redirectBack(assignmentId, await startContributorAssignment({ assignmentId, actorUserId: user.id }))
}
