import { afterEach, describe, expect, it } from 'vitest'

import { claimGroupOffer, createGroupOffer } from '@/lib/matchTrackingAssignments'
import { prisma } from '@/lib/prisma'

const enabled = process.env.ENABLE_MATCH_TRACKING_DEV_HARNESS === 'true'
const trackingTaskId = process.env.MATCH_TRACKING_GROUP_CLAIM_TASK_ID
const assignedByUserId = process.env.MATCH_TRACKING_GROUP_CLAIM_ASSIGNED_BY_USER_ID
const recipientA = process.env.MATCH_TRACKING_GROUP_CLAIM_RECIPIENT_A_USER_ID
const recipientB = process.env.MATCH_TRACKING_GROUP_CLAIM_RECIPIENT_B_USER_ID

const shouldRun = Boolean(enabled && trackingTaskId && assignedByUserId && recipientA && recipientB)
const run = shouldRun ? describe : describe.skip

let createdAssignmentId: string | null = null

run('match tracking group claim integration', () => {
  afterEach(async () => {
    if (!createdAssignmentId) return
    await prisma.matchContributorAssignment.deleteMany({ where: { id: createdAssignmentId } })
    createdAssignmentId = null
  })

  it('allows exactly one competing group-offer claim', async () => {
    const created = await createGroupOffer({
      actorUserId: assignedByUserId!,
      trackingTaskId: trackingTaskId!,
      recipientUserIds: [recipientA!, recipientB!],
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAssignmentId = created.value.id

    const claims = await Promise.allSettled([
      claimGroupOffer({ assignmentId: createdAssignmentId, actorUserId: recipientA! }),
      claimGroupOffer({ assignmentId: createdAssignmentId, actorUserId: recipientB! }),
    ])
    const results = claims.map((claim) => claim.status === 'fulfilled' ? claim.value : { ok: false })
    expect(results.filter((result) => result.ok).length).toBe(1)
    expect(results.filter((result) => !result.ok).length).toBe(1)

    const assignment = await prisma.matchContributorAssignment.findUnique({
      where: { id: createdAssignmentId },
      include: { recipients: true },
    })
    expect(assignment?.status).toBe('ACCEPTED')
    expect(assignment?.assignedUserId === recipientA || assignment?.assignedUserId === recipientB).toBe(true)
    expect(assignment?.recipients.filter((recipient) => recipient.userId !== assignment.assignedUserId).every((recipient) => recipient.closedAt !== null)).toBe(true)
  })
})
