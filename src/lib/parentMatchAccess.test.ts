import { describe, expect, it, vi } from 'vitest'

import { validateParentSubmission } from '@/lib/parentMatchAccess'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    matchDay: {
      findUnique: async () => ({
        id: 'match-1',
        status: 'IN_PROGRESS',
        firstHalfStartedAt: new Date('2026-07-30T10:00:00.000Z'),
        firstHalfEndedAt: null,
        secondHalfStartedAt: null,
        secondHalfEndedAt: null,
        team: { clubId: 'club-1' },
        matchDayEventTypes: [{
          id: 'selected-goal',
          eventType: 'GOAL',
          eventDefinitionId: null,
          eventDefinition: null,
        }],
      }),
    },
    spectatorAccess: {
      findFirst: async ({ where }: { where: { playerId: string } }) => where.playerId ? { id: 'access-1' } : null,
    },
    matchDayPlayer: { findFirst: async () => ({ id: 'match-player-1' }) },
    matchPlayerStint: { findFirst: async () => ({ id: 'stint-1' }) },
  },
}))

describe('parent submission access', () => {
  it('still requires a linked player', async () => {
    const result = await validateParentSubmission({ userId: 'parent-1', matchDayId: 'match-1', playerId: '', eventKey: 'legacy:GOAL' })
    expect(result).toMatchObject({ ok: false, reason: 'You are not linked to this player.' })
  })
})
