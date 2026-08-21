import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { getAppBaseUrl } from '@/lib/appUrl'
import { createPlayerInvitation, createTeamInvitation, getInvitationAcceptUrl } from '@/lib/invitations'

const originalEnv = { ...process.env }

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
}

const setEnv = (key: string, value: string) => {
  process.env[key] = value
}

describe('invitations', () => {
  beforeEach(() => {
    restoreEnv()
    mockState.invitations = []
    mockState.teams = [{ id: 'team-1', clubId: 'club-1' }]
    mockState.players = [{ id: 'player-1', clubId: 'club-1' }]
    mockState.transactionQueue = Promise.resolve()
    vi.clearAllMocks()
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('falls back to localhost only for local development and tests', () => {
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    delete process.env.VERCEL_URL
    setEnv('NODE_ENV', 'development')

    expect(getAppBaseUrl()).toBe('http://localhost:3000')
  })

  it('uses the explicit production application URL', () => {
    setEnv('NODE_ENV', 'production')
    process.env.APP_URL = 'https://canyoucoach.app'

    expect(getAppBaseUrl()).toBe('https://canyoucoach.app')
  })

  it('normalizes trailing slashes', () => {
    process.env.APP_URL = 'https://canyoucoach.app/'

    expect(getAppBaseUrl()).toBe('https://canyoucoach.app')
  })

  it('normalizes Vercel hostnames without protocols to HTTPS', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'canyoucoach.app'

    expect(getAppBaseUrl()).toBe('https://canyoucoach.app')
  })

  it('prefers the Vercel production URL over deployment-specific URLs in production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'canyoucoach.app'
    process.env.VERCEL_URL = 'can-you-coach-git-preview.vercel.app'

    expect(getAppBaseUrl()).toBe('https://canyoucoach.app')
  })

  it('uses deployment-specific Vercel URLs for non-production previews', () => {
    setEnv('NODE_ENV', 'production')
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'can-you-coach-git-preview.vercel.app'

    expect(getAppBaseUrl()).toBe('https://can-you-coach-git-preview.vercel.app')
  })

  it('does not fall back to localhost in production', () => {
    setEnv('NODE_ENV', 'production')
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    delete process.env.VERCEL_URL

    expect(() => getAppBaseUrl()).toThrow('A canonical application URL is required in production')
  })

  it('fails safely for invalid production URLs', () => {
    setEnv('NODE_ENV', 'production')
    process.env.APP_URL = 'http://canyoucoach.app'

    expect(() => getAppBaseUrl()).toThrow('APP_URL must use HTTPS in production')

    process.env.APP_URL = 'https://user:pass@canyoucoach.app'
    expect(() => getAppBaseUrl()).toThrow('APP_URL must not include credentials')

    process.env.APP_URL = 'https://canyoucoach.app/invite'
    expect(() => getAppBaseUrl()).toThrow('APP_URL must include only an origin')
  })

  it('URL-encodes invite tokens without logging them', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.APP_URL = 'https://canyoucoach.app'

    const link = getInvitationAcceptUrl('test token/with spaces?&')

    expect(link).toBe(`https://canyoucoach.app/invite/accept?token=${encodeURIComponent('test token/with spaces?&')}`)
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('reuses one active pending team invitation for simultaneous equivalent requests', async () => {
    process.env.APP_URL = 'https://app.test'

    const requests = await Promise.all([
      createTeamInvitation({ clubId: 'club-1', teamId: 'team-1', email: ' Coach@Example.com ', invitedByUserId: 'owner-1', type: 'TEAM_COACH' }),
      createTeamInvitation({ clubId: 'club-1', teamId: 'team-1', email: 'coach@example.com', invitedByUserId: 'owner-1', type: 'TEAM_COACH' }),
    ])

    expect(requests[0]).toEqual(requests[1])
    expect(mockState.invitations).toHaveLength(1)
    expect(mockState.invitations[0].normalizedEmail).toBe('coach@example.com')
  })

  it('does not reuse expired, revoked or accepted invitations', async () => {
    process.env.APP_URL = 'https://app.test'
    mockState.invitations.push({ token: 'old', email: 'parent@example.com', normalizedEmail: 'parent@example.com', type: 'PLAYER_PARENT', clubId: 'club-1', teamId: null, playerId: 'player-1', invitedByUserId: 'owner-1', status: 'EXPIRED', expiresAt: new Date('2020-01-01'), createdAt: new Date('2020-01-01') })

    const result = await createPlayerInvitation({ clubId: 'club-1', playerId: 'player-1', email: 'parent@example.com', invitedByUserId: 'owner-1', type: 'PLAYER_PARENT' })

    expect(result.ok).toBe(true)
    expect(mockState.invitations).toHaveLength(2)
  })

  it('displays a reused existing pending invitation with the current canonical domain', async () => {
    process.env.APP_URL = 'https://canyoucoach.app'
    mockState.invitations.push({ token: 'pending-test-token', email: 'coach@example.com', normalizedEmail: 'coach@example.com', type: 'TEAM_COACH', clubId: 'club-1', teamId: 'team-1', playerId: null, invitedByUserId: 'owner-1', status: 'PENDING', expiresAt: new Date('2999-01-01'), createdAt: new Date('2026-01-01') })

    const result = await createTeamInvitation({ clubId: 'club-1', teamId: 'team-1', email: 'coach@example.com', invitedByUserId: 'owner-1', type: 'TEAM_COACH' })

    expect(result).toEqual({ ok: true, inviteLink: 'https://canyoucoach.app/invite/accept?token=pending-test-token' })
    expect(mockState.invitations).toHaveLength(1)
  })

  it('uses identical URL construction for parent and staff invitation flows', async () => {
    process.env.APP_URL = 'https://canyoucoach.app/'

    const staffResult = await createTeamInvitation({ clubId: 'club-1', teamId: 'team-1', email: 'coach@example.com', invitedByUserId: 'owner-1', type: 'TEAM_ASSISTANT' })
    const parentResult = await createPlayerInvitation({ clubId: 'club-1', playerId: 'player-1', email: 'parent@example.com', invitedByUserId: 'owner-1', type: 'PLAYER_PARENT' })

    expect(staffResult.ok).toBe(true)
    expect(parentResult.ok).toBe(true)
    if (!staffResult.ok || !parentResult.ok) return

    expect(new URL(staffResult.inviteLink).origin).toBe('https://canyoucoach.app')
    expect(new URL(parentResult.inviteLink).origin).toBe('https://canyoucoach.app')
    expect(new URL(staffResult.inviteLink).pathname).toBe('/invite/accept')
    expect(new URL(parentResult.inviteLink).pathname).toBe('/invite/accept')
  })
})
