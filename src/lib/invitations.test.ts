import { beforeEach, describe, expect, it, vi } from 'vitest'

type InvitationRow = {
  token: string
  email: string
  normalizedEmail: string
  type: string
  clubId: string
  teamId: string | null
  playerId: string | null
  invitedByUserId: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  expiresAt: Date
  createdAt: Date
}

const mockState = vi.hoisted(() => ({
  invitations: [] as InvitationRow[],
  teams: [] as Array<{ id: string; clubId: string }>,
  players: [] as Array<{ id: string; clubId: string }>,
  transactionQueue: Promise.resolve() as Promise<unknown>,
}))

const invitationDelegate = vi.hoisted(() => ({
  findUnique: vi.fn(async ({ where }: { where: { token?: string } }) => mockState.invitations.find((invitation) => invitation.token === where.token) ?? null),
  findFirst: vi.fn(async ({ where }: { where: Partial<InvitationRow> & { expiresAt?: { gt: Date } } }) => mockState.invitations.find((invitation) =>
    invitation.clubId === where.clubId &&
    invitation.teamId === (where.teamId ?? null) &&
    invitation.playerId === (where.playerId ?? null) &&
    invitation.normalizedEmail === where.normalizedEmail &&
    invitation.type === where.type &&
    invitation.status === where.status &&
    (!where.expiresAt?.gt || invitation.expiresAt > where.expiresAt.gt)
  ) ?? null),
  create: vi.fn(async ({ data, select }: { data: Omit<InvitationRow, 'createdAt' | 'status'>; select?: { token?: boolean } }) => {
    const row = { ...data, status: 'PENDING' as const, createdAt: new Date() }
    mockState.invitations.push(row)
    return select?.token ? { token: row.token } : row
  }),
  update: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    invitation: invitationDelegate,
    team: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; clubId: string } }) => mockState.teams.find((team) => team.id === where.id && team.clubId === where.clubId) ?? null),
    },
    player: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; team: { clubId: string } } }) => mockState.players.find((player) => player.id === where.id && player.clubId === where.team.clubId) ?? null),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => {
      const run = mockState.transactionQueue.then(() => callback({ invitation: invitationDelegate }))
      mockState.transactionQueue = run.catch(() => undefined)
      return run
    }),
  },
}))

vi.mock('@/lib/permissions', () => ({
  isOwnerForClub: vi.fn(async () => true),
}))

import { createPlayerInvitation, createTeamInvitation } from '@/lib/invitations'

describe('invitations', () => {
  beforeEach(() => {
    mockState.invitations = []
    mockState.teams = [{ id: 'team-1', clubId: 'club-1' }]
    mockState.players = [{ id: 'player-1', clubId: 'club-1' }]
    mockState.transactionQueue = Promise.resolve()
    vi.clearAllMocks()
  })

  it('reuses one active pending team invitation for simultaneous equivalent requests', async () => {
    const requests = await Promise.all([
      createTeamInvitation({ clubId: 'club-1', teamId: 'team-1', email: ' Coach@Example.com ', invitedByUserId: 'owner-1', type: 'TEAM_COACH', origin: 'https://app.test' }),
      createTeamInvitation({ clubId: 'club-1', teamId: 'team-1', email: 'coach@example.com', invitedByUserId: 'owner-1', type: 'TEAM_COACH', origin: 'https://app.test' }),
    ])

    expect(requests[0]).toEqual(requests[1])
    expect(mockState.invitations).toHaveLength(1)
    expect(mockState.invitations[0].normalizedEmail).toBe('coach@example.com')
  })

  it('does not reuse expired, revoked or accepted invitations', async () => {
    mockState.invitations.push({ token: 'old', email: 'parent@example.com', normalizedEmail: 'parent@example.com', type: 'PLAYER_PARENT', clubId: 'club-1', teamId: null, playerId: 'player-1', invitedByUserId: 'owner-1', status: 'EXPIRED', expiresAt: new Date('2020-01-01'), createdAt: new Date('2020-01-01') })

    const result = await createPlayerInvitation({ clubId: 'club-1', playerId: 'player-1', email: 'parent@example.com', invitedByUserId: 'owner-1', type: 'PLAYER_PARENT', origin: 'https://app.test' })

    expect(result.ok).toBe(true)
    expect(mockState.invitations).toHaveLength(2)
  })
})
