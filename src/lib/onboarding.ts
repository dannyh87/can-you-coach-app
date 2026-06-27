import { getManageableTeamIds, getRecordableTeamIds } from '@/lib/accessWhere'
import { prisma } from '@/lib/prisma'

export type OnboardingChecklistItem = {
  key: string
  label: string
  description: string
  complete: boolean
  href: string
}

export type OnboardingCta = {
  label: string
  href: string
}

export type OnboardingState =
  | {
      kind: 'coach_setup'
      completedCount: number
      totalCount: number
      items: OnboardingChecklistItem[]
      primaryCta: OnboardingCta
      secondaryCtas: OnboardingCta[]
    }
  | {
      kind: 'complete'
      completedCount: number
      totalCount: number
      primaryCta: OnboardingCta
      secondaryCtas: OnboardingCta[]
    }
  | {
      kind: 'assistant'
      assignedTeamCount: number
      primaryCta: OnboardingCta
      secondaryCtas: OnboardingCta[]
    }
  | {
      kind: 'parent'
      linkedPlayerCount: number
      primaryCta: OnboardingCta
      secondaryCtas: OnboardingCta[]
    }
  | {
      kind: 'no_access'
      primaryCta: OnboardingCta
    }

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [memberships, manageableTeamIds, recordableTeamIds, linkedPlayerCount] = await Promise.all([
    prisma.clubMembership.findMany({
      where: { userId },
      include: { teamAssignments: { select: { teamId: true } } },
    }),
    getManageableTeamIds(userId),
    getRecordableTeamIds(userId),
    prisma.spectatorAccess.count({ where: { userId } }),
  ])

  const hasManageRole = memberships.some((membership) => membership.role === 'OWNER' || membership.role === 'COACH')
  const hasAssistantRole = memberships.some((membership) => membership.role === 'ASSISTANT_COACH')
  const hasAnyClubAccess = memberships.length > 0

  if (hasManageRole || manageableTeamIds.length > 0) {
    return getCoachSetupState(manageableTeamIds, hasManageRole)
  }

  if (hasAssistantRole || recordableTeamIds.length > 0) {
    return {
      kind: 'assistant',
      assignedTeamCount: recordableTeamIds.length,
      primaryCta: { label: 'Open Match Day', href: '/match-day' },
      secondaryCtas: [
        { label: 'Open Fitness', href: '/fitness' },
        { label: 'View Players', href: '/players' },
      ],
    }
  }

  if (linkedPlayerCount > 0) {
    return {
      kind: 'parent',
      linkedPlayerCount,
      primaryCta: { label: 'View your linked player', href: '/my-player' },
      secondaryCtas: [
        { label: 'Match observations', href: '/my-player/matches' },
      ],
    }
  }

  if (!hasAnyClubAccess) {
    return {
      kind: 'no_access',
      primaryCta: { label: 'Create your first club', href: '/club-setup' },
    }
  }

  return {
    kind: 'no_access',
    primaryCta: { label: 'Go to Home', href: '/' },
  }
}

async function getCoachSetupState(manageableTeamIds: string[], hasManageRole: boolean): Promise<OnboardingState> {
  const teamFilter = { teamId: { in: manageableTeamIds } }
  const [activePlayerCount, fitnessSessionCount, matchDayCount] = manageableTeamIds.length === 0
    ? [0, 0, 0]
    : await Promise.all([
        prisma.player.count({ where: { ...teamFilter, isActive: true } }),
        prisma.fitnessTestSession.count({ where: teamFilter }),
        prisma.matchDay.count({ where: teamFilter }),
      ])

  const items: OnboardingChecklistItem[] = [
    {
      key: 'club',
      label: 'Club/team access ready',
      description: 'Create your club or confirm your coaching access.',
      complete: hasManageRole || manageableTeamIds.length > 0,
      href: '/club-setup',
    },
    {
      key: 'team',
      label: 'Team added',
      description: 'Add or select the team you coach.',
      complete: manageableTeamIds.length > 0,
      href: '/club-setup',
    },
    {
      key: 'players',
      label: 'Players added',
      description: 'Add one player or import your squad from CSV.',
      complete: activePlayerCount > 0,
      href: '/players/import',
    },
    {
      key: 'fitness',
      label: 'First fitness test created',
      description: 'Start a simple test to begin collecting player progress.',
      complete: fitnessSessionCount > 0,
      href: '/fitness/sessions/new',
    },
    {
      key: 'match',
      label: 'First match day created',
      description: 'Prepare a match day squad and event setup.',
      complete: matchDayCount > 0,
      href: '/match-day/new',
    },
  ]
  const completedCount = items.filter((item) => item.complete).length
  const primaryCta = getCoachPrimaryCta({
    teamCount: manageableTeamIds.length,
    activePlayerCount,
    fitnessSessionCount,
    matchDayCount,
  })
  const secondaryCtas = [
    { label: 'Add one player', href: '/players' },
    { label: 'Import players', href: '/players/import' },
    { label: 'Manage access later', href: '/club-setup/access' },
  ]

  if (completedCount === items.length) {
    return {
      kind: 'complete',
      completedCount,
      totalCount: items.length,
      primaryCta: { label: 'Continue coaching', href: '/fitness' },
      secondaryCtas: [
        { label: 'Open Match Day', href: '/match-day' },
        { label: 'Manage Squad', href: '/players' },
      ],
    }
  }

  return {
    kind: 'coach_setup',
    completedCount,
    totalCount: items.length,
    items,
    primaryCta,
    secondaryCtas,
  }
}

function getCoachPrimaryCta({
  teamCount,
  activePlayerCount,
  fitnessSessionCount,
  matchDayCount,
}: {
  teamCount: number
  activePlayerCount: number
  fitnessSessionCount: number
  matchDayCount: number
}): OnboardingCta {
  if (teamCount === 0) return { label: 'Set up your club/team', href: '/club-setup' }
  if (activePlayerCount === 0) return { label: 'Import your squad', href: '/players/import' }
  if (fitnessSessionCount === 0) return { label: 'Run your first fitness test', href: '/fitness/sessions/new' }
  if (matchDayCount === 0) return { label: 'Set up your first match day', href: '/match-day/new' }
  return { label: 'Continue coaching', href: '/fitness' }
}
