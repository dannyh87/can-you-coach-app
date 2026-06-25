import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import { prisma } from '@/lib/prisma'

export type AccessSummary = {
  label: string
  title: string
  tone: 'slate' | 'blue' | 'green' | 'amber' | 'purple'
}

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`

export async function getCurrentAccessSummary(user: { id: string; email: string }): Promise<AccessSummary> {
  const [memberships, parentLinkCount] = await Promise.all([
    prisma.clubMembership.findMany({
      where: { userId: user.id },
      include: {
        club: {
          include: {
            teams: { select: { id: true } },
          },
        },
        teamAssignments: { select: { teamId: true } },
      },
    }),
    prisma.spectatorAccess.count({ where: { userId: user.id } }),
  ])

  const isSuperAdmin = canManageGlobalEventLibrary(user)
  const clubAdminClubIds = new Set<string>()
  const coachTeamIds = new Set<string>()
  const assistantTeamIds = new Set<string>()

  for (const membership of memberships) {
    if (membership.role === 'OWNER') {
      clubAdminClubIds.add(membership.clubId)
      continue
    }

    if (membership.role === 'COACH') {
      membership.teamAssignments.forEach((assignment) => coachTeamIds.add(assignment.teamId))
      continue
    }

    if (membership.role === 'ASSISTANT_COACH') {
      membership.teamAssignments.forEach((assignment) => assistantTeamIds.add(assignment.teamId))
    }
  }

  const summaryParts: string[] = []
  if (isSuperAdmin) summaryParts.push('Super Admin')
  if (clubAdminClubIds.size > 0) {
    summaryParts.push(clubAdminClubIds.size === 1 ? 'Club Admin' : `Club Admin · ${pluralize(clubAdminClubIds.size, 'club')}`)
  }
  if (coachTeamIds.size > 0) summaryParts.push(`Coach · ${pluralize(coachTeamIds.size, 'team')}`)
  if (assistantTeamIds.size > 0) summaryParts.push(`Assistant Coach · ${pluralize(assistantTeamIds.size, 'team')}`)
  if (parentLinkCount > 0) summaryParts.push(`Parent Contributor · ${pluralize(parentLinkCount, 'player')}`)

  const fullTitle = summaryParts.length > 0 ? summaryParts.join(' · ') : 'No club access'
  const primaryLabel = getPrimaryLabel({
    isSuperAdmin,
    clubAdminClubCount: clubAdminClubIds.size,
    coachTeamCount: coachTeamIds.size,
    assistantTeamCount: assistantTeamIds.size,
    parentLinkCount,
  })

  return {
    label: primaryLabel,
    title: fullTitle,
    tone: getSummaryTone({ isSuperAdmin, clubAdminClubCount: clubAdminClubIds.size, parentLinkCount }),
  }
}

function getPrimaryLabel({
  isSuperAdmin,
  clubAdminClubCount,
  coachTeamCount,
  assistantTeamCount,
  parentLinkCount,
}: {
  isSuperAdmin: boolean
  clubAdminClubCount: number
  coachTeamCount: number
  assistantTeamCount: number
  parentLinkCount: number
}) {
  if (isSuperAdmin && clubAdminClubCount > 0) return 'Super Admin · Club Admin'
  if (isSuperAdmin) return 'Super Admin'
  if (clubAdminClubCount > 0) return clubAdminClubCount === 1 ? 'Club Admin' : `Club Admin · ${pluralize(clubAdminClubCount, 'club')}`
  if (coachTeamCount > 0) return `Coach · ${pluralize(coachTeamCount, 'team')}`
  if (assistantTeamCount > 0) return `Assistant Coach · ${pluralize(assistantTeamCount, 'team')}`
  if (parentLinkCount > 0) return `Parent Contributor · ${pluralize(parentLinkCount, 'player')}`
  return 'No club access'
}

function getSummaryTone({
  isSuperAdmin,
  clubAdminClubCount,
  parentLinkCount,
}: {
  isSuperAdmin: boolean
  clubAdminClubCount: number
  parentLinkCount: number
}) {
  if (isSuperAdmin) return 'purple'
  if (clubAdminClubCount > 0) return 'blue'
  if (parentLinkCount > 0) return 'amber'
  return 'slate'
}
