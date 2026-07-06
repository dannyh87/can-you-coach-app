import Link from 'next/link'
import { redirect } from 'next/navigation'

import MatchDayWizard from '@/app/match-day/new/MatchDayWizard'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import {
  getActiveRecordableEventDefinitions,
  getMatchDayEventCategoryFallback,
  getRecordableEventPhaseGroups,
} from '@/lib/eventDefinitions'
import {
  inferAgePhase,
} from '@/lib/matchEventTaxonomy'
import { canManageTeamData } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const matchTypes = ['LEAGUE', 'CUP', 'FRIENDLY'] as const
const matchVenues = ['HOME', 'AWAY', 'NEUTRAL'] as const
const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function createMatchFromWizard(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  const date = getTextValue(formData, 'date')
  const kickoffTime = getTextValue(formData, 'kickoffTime')
  const opposition = getTextValue(formData, 'opposition')
  const matchType = getTextValue(formData, 'matchType')
  const venue = getTextValue(formData, 'venue')
  const selectedEventDefinitionIds = Array.from(new Set(formData
    .getAll('eventDefinitionId')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)))
  const playerStatuses = formData
    .getAll('playerStatus')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => {
      const [playerId, squadStatus] = value.split(':')
      return { playerId, squadStatus }
    })

  if (!teamId || !date || !kickoffTime || !opposition || !matchType || !venue) {
    return { ok: false as const, reason: 'Match details, team and venue are required.' }
  }
  if (!matchTypes.includes(matchType as (typeof matchTypes)[number])) return { ok: false as const, reason: 'Match type is invalid.' }
  if (!matchVenues.includes(venue as (typeof matchVenues)[number])) return { ok: false as const, reason: 'Venue is invalid.' }
  if (!(await canManageTeamData(user.id, teamId))) return { ok: false as const, reason: 'You cannot create a match for this team.' }

  const kickoffAt = new Date(`${date}T${kickoffTime}:00`)
  if (Number.isNaN(kickoffAt.getTime())) return { ok: false as const, reason: 'Kick-off date or time is invalid.' }

  const activePlayers = await prisma.player.findMany({
    where: { teamId, isActive: true },
    select: { id: true, squadNumber: true },
  })
  const activePlayerIds = new Set(activePlayers.map((player) => player.id))
  const playerStatusById = new Map(
    playerStatuses
      .filter(({ playerId, squadStatus }) => activePlayerIds.has(playerId) && squadStatuses.includes(squadStatus as (typeof squadStatuses)[number]))
      .map(({ playerId, squadStatus }) => [playerId, squadStatus as (typeof squadStatuses)[number]])
  )
  if (selectedEventDefinitionIds.length === 0) return { ok: false as const, reason: 'Select at least one event to track.' }

  const selectedEvents = await prisma.eventDefinition.findMany({
    where: {
      id: { in: selectedEventDefinitionIds },
      isActive: true,
    },
  })
  if (selectedEvents.length !== selectedEventDefinitionIds.length) {
    return { ok: false as const, reason: 'One or more selected events are no longer available.' }
  }

  const match = await prisma.matchDay.create({
    data: {
      teamId,
      kickoffAt,
      opposition,
      matchType: matchType as (typeof matchTypes)[number],
      venue: venue as (typeof matchVenues)[number],
      matchDayPlayers: {
        create: activePlayers.map((player) => {
          const squadStatus = playerStatusById.get(player.id) ?? 'NOT_INVOLVED'
          return {
            playerId: player.id,
            squadStatus,
            shirtNumberSnapshot: player.squadNumber,
            isTracked: squadStatus !== 'NOT_INVOLVED',
          }
        }),
      },
      matchDayEventTypes: {
        create: selectedEvents.map((eventDefinition) => ({
          eventDefinitionId: eventDefinition.id,
          eventType: eventDefinition.legacyEventType ?? null,
          category: getMatchDayEventCategoryFallback(eventDefinition),
        })),
      },
    },
  })

  redirect(`/match-day/${match.id}`)
}

export default async function NewMatchDayPage() {
  const user = await getCurrentUser()
  const manageableTeamIds = await getManageableTeamIds(user.id)
  const teams = await prisma.team.findMany({
    where: { AND: [await accessibleTeamWhere(user.id), { id: { in: manageableTeamIds } }] },
    include: {
      club: true,
      players: {
        where: { isActive: true },
        orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
      },
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })
  const recordableEventOptions = await getActiveRecordableEventDefinitions({ legacyOnly: true })
  const matchPhaseGroups = getRecordableEventPhaseGroups(recordableEventOptions)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/match-day" className="text-sm font-semibold text-blue-800 hover:underline">
        Back to Match Day
      </Link>
      <PageHeader title="Create Match Day" description="Set up only what helps coaching observation and review." />
      <MatchDayWizard
        teams={teams.map((team) => ({
          id: team.id,
          name: team.name,
          clubName: team.club.name,
          ageGroup: team.ageGroup,
          inferredAgePhase: inferAgePhase(team.ageGroup),
          players: team.players.map((player) => ({
            id: player.id,
            name: `${player.firstName} ${player.surname}`,
            squadNumber: player.squadNumber,
            preferredPosition: player.preferredPosition,
          })),
        }))}
        matchPhaseGroups={matchPhaseGroups.map((group) => ({
          value: group.value,
          label: group.label,
          events: group.events.map((event) => ({
            id: event.id,
            label: event.label,
            category: event.category,
            categoryLabel: event.categoryLabel,
            subcategory: event.subcategory,
            description: event.description,
            videoUrl: event.videoUrl,
            matchPhase: event.matchPhase,
            matchPhaseLabel: event.matchPhaseLabel,
            agePhases: event.agePhases,
            fourCorner: event.fourCorner,
            positionRelevance: event.positionRelevance,
            requiresLocation: event.requiresLocation,
            enabledByDefault: event.enabledByDefault,
          })),
        }))}
        createAction={createMatchFromWizard}
      />
    </main>
  )
}
