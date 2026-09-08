import Link from 'next/link'
import { redirect } from 'next/navigation'

import MatchDayWizard from '@/app/match-day/new/MatchDayWizard'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import {
  createTeamCustomObservationForMatchSetup,
  findCustomObservationCreationConflicts,
  getActiveSelectableCustomObservationsForTeam,
  MAX_CLASSIC_CUSTOM_OBSERVATIONS,
  type CustomObservationSelectable,
  type QuickCustomObservationInput,
  validateClassicObservationSelectionCounts,
  validateCustomObservationForNewMatchSelection,
  validateMatchDayEventTypeIdentityShape,
} from '@/lib/clubTrackingDefinitions'
import { isMatchDayCustomObservationsEnabled } from '@/lib/features'
import { buildClassicMatchDayPlayerCreates, MAX_CLASSIC_OBSERVATIONS } from '@/lib/matchDayClassicSetup'
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
const quickCustomCategories = ['PASSING', 'RECEIVING', 'DRIBBLING_1V1', 'SHOOTING', 'DEFENDING', 'GOALKEEPING', 'DISCIPLINE', 'INJURIES', 'OTHER'] as const
const quickCustomPolarities = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] as const
const customObservationLoadErrorMessage = 'Could not load custom observations for this team.'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getUniqueTextValues = (formData: FormData, key: string) => Array.from(new Set(formData
  .getAll(key)
  .filter((value): value is string => typeof value === 'string')
  .map((value) => value.trim())
  .filter(Boolean)))

async function createCustomObservationAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const category = getTextValue(formData, 'eventCategory')
  const polarity = getTextValue(formData, 'polarity')
  const input: QuickCustomObservationInput = {
    teamId: getTextValue(formData, 'teamId'),
    name: getTextValue(formData, 'name'),
    countingDefinition: getTextValue(formData, 'countingDefinition'),
    eventCategory: (quickCustomCategories.includes(category as (typeof quickCustomCategories)[number]) ? category : 'OTHER') as QuickCustomObservationInput['eventCategory'],
    polarity: (quickCustomPolarities.includes(polarity as (typeof quickCustomPolarities)[number]) ? polarity : 'NEUTRAL') as QuickCustomObservationInput['polarity'],
    guidance: getTextValue(formData, 'guidance'),
    requiresLocation: formData.get('requiresLocation') === 'on',
    createAnyway: formData.get('createAnyway') === 'true',
    currentEventDefinitionIds: getUniqueTextValues(formData, 'currentEventDefinitionId'),
    currentClubTrackingDefinitionIds: getUniqueTextValues(formData, 'currentClubTrackingDefinitionId'),
  }
  return createTeamCustomObservationForMatchSetup({ userId: user.id, input })
}

async function checkCustomObservationConflictsAction(formData: FormData) {
  'use server'

  if (!isMatchDayCustomObservationsEnabled()) return { ok: false as const, reason: 'Custom observations are not enabled.' }
  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  if (!(await canManageTeamData(user.id, teamId))) return { ok: false as const, reason: 'You cannot manage tracking setup for this team.' }
  return findCustomObservationCreationConflicts({ teamId, name: getTextValue(formData, 'name') })
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
  const trackPlayerMinutes = getTextValue(formData, 'trackPlayerMinutes') === 'true'
  const eventTrackingScope = getTextValue(formData, 'eventTrackingScope') === 'PLAYER' ? 'PLAYER' : 'TEAM'
  const trackedPlayerIds = new Set(formData
    .getAll('trackedPlayerId')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean))
  const selectedEventDefinitionIds = Array.from(new Set(formData
    .getAll('eventDefinitionId')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
      .filter(Boolean)))
  const submittedClubTrackingDefinitionIds = getUniqueTextValues(formData, 'clubTrackingDefinitionId')
  if (!isMatchDayCustomObservationsEnabled() && submittedClubTrackingDefinitionIds.length > 0) {
    return { ok: false as const, reason: 'Custom observations are not available for this match.' }
  }
  const selectedClubTrackingDefinitionIds = isMatchDayCustomObservationsEnabled()
    ? submittedClubTrackingDefinitionIds
    : []
  const playerStatuses = formData
    .getAll('playerStatus')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => {
      const [playerId, squadStatus] = value.split(':')
      return { playerId, squadStatus }
    })
  const startingPositions = new Map(formData
    .getAll('startingPosition')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => {
      const [playerId, ...positionParts] = value.split(':')
      return [playerId, positionParts.join(':').trim()]
    }))
  const trackedStateById = new Map(formData
    .getAll('playerTracked')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => {
      const [playerId, isTracked] = value.split(':')
      return [playerId, isTracked === 'true']
    }))

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
  const countValidation = isMatchDayCustomObservationsEnabled()
    ? validateClassicObservationSelectionCounts({ eventDefinitionIds: selectedEventDefinitionIds, clubTrackingDefinitionIds: selectedClubTrackingDefinitionIds })
    : selectedEventDefinitionIds.length === 0
      ? { ok: false as const, reason: 'Select at least one event to track for this match.' }
      : selectedEventDefinitionIds.length > MAX_CLASSIC_OBSERVATIONS
        ? { ok: false as const, reason: `Select no more than ${MAX_CLASSIC_OBSERVATIONS} events for this match.` }
        : { ok: true as const, value: true }
  if (!countValidation.ok) return { ok: false as const, reason: countValidation.reason }

  const selectedEvents = await prisma.eventDefinition.findMany({
    where: {
      id: { in: selectedEventDefinitionIds },
      isActive: true,
    },
  })
  if (selectedEvents.length !== selectedEventDefinitionIds.length) {
    return { ok: false as const, reason: 'One or more selected events are no longer available.' }
  }
  const customSelectionValidations = await Promise.all(selectedClubTrackingDefinitionIds.map((clubTrackingDefinitionId) =>
    validateCustomObservationForNewMatchSelection({ userId: user.id, teamId, clubTrackingDefinitionId })
  ))
  const invalidCustomSelection = customSelectionValidations.find((result) => !result.ok)
  if (invalidCustomSelection && !invalidCustomSelection.ok) return { ok: false as const, reason: invalidCustomSelection.reason }
  const selectedCustomDefinitions = selectedClubTrackingDefinitionIds.length > 0 ? await prisma.clubTrackingDefinition.findMany({ where: { id: { in: selectedClubTrackingDefinitionIds } } }) : []
  if (selectedCustomDefinitions.length !== selectedClubTrackingDefinitionIds.length) return { ok: false as const, reason: 'One or more custom observations are no longer available.' }

  const matchDayPlayerCreates = buildClassicMatchDayPlayerCreates({
    activePlayers,
    trackPlayerMinutes,
    eventTrackingScope,
    trackedPlayerIds,
    playerStatusById,
    startingPositionById: startingPositions,
    isTrackedById: trackedStateById,
  })
  if (!trackPlayerMinutes && eventTrackingScope === 'PLAYER' && matchDayPlayerCreates.length === 0) {
    return { ok: false as const, reason: 'Select at least one player to track.' }
  }

  const match = await prisma.matchDay.create({
    data: {
      teamId,
      kickoffAt,
      opposition,
      matchType: matchType as (typeof matchTypes)[number],
      venue: venue as (typeof matchVenues)[number],
      eventTrackingScope,
      trackPlayerMinutes,
      matchDayPlayers: {
        create: matchDayPlayerCreates,
      },
      matchDayEventTypes: {
        create: [
          ...selectedEvents.map((eventDefinition) => {
            const row = {
              eventDefinitionId: eventDefinition.id,
              clubTrackingDefinitionId: null,
              eventType: eventDefinition.legacyEventType ?? null,
              category: getMatchDayEventCategoryFallback(eventDefinition),
            }
            const shape = validateMatchDayEventTypeIdentityShape(row)
            if (!shape.ok) throw new Error(shape.reason)
            return row
          }),
          ...selectedCustomDefinitions.map((definition) => {
            const row = {
              eventDefinitionId: null,
              clubTrackingDefinitionId: definition.id,
              eventType: null,
              category: getCustomMatchEventCategory(definition.eventCategory),
            }
            const shape = validateMatchDayEventTypeIdentityShape(row)
            if (!shape.ok) throw new Error(shape.reason)
            return row
          }),
        ],
      },
    },
  })

  redirect(`/match-day/${match.id}`)
}

function getCustomMatchEventCategory(category: CustomObservationSelectable['category']) {
  if (category === 'DEFENDING') return 'OUT_OF_POSSESSION' as const
  if (category === 'PASSING' || category === 'RECEIVING' || category === 'DRIBBLING_1V1') return 'IN_POSSESSION' as const
  return 'ATTACKING' as const
}

async function validateTemplateForTeam(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const templateId = getTextValue(formData, 'templateId')
  const teamId = getTextValue(formData, 'teamId')
  if (!templateId || !teamId) return { ok: false as const, reason: 'Template and team are required.' }
  if (!(await canManageTeamData(user.id, teamId))) return { ok: false as const, reason: 'You cannot create a match for this team.' }

  const template = await prisma.matchDay.findFirst({
    where: { id: templateId, teamId },
    select: { id: true },
  })
  if (!template) return { ok: false as const, reason: 'That previous setup is not available for the selected team.' }
  if (!(await canManageMatchDayForTemplate(user.id, templateId))) {
    return { ok: false as const, reason: 'That previous setup is not available to you.' }
  }

  return { ok: true as const }
}

async function canManageMatchDayForTemplate(userId: string, matchDayId: string) {
  const match = await prisma.matchDay.findUnique({ where: { id: matchDayId }, select: { teamId: true } })
  return Boolean(match && await canManageTeamData(userId, match.teamId))
}

export default async function NewMatchDayPage() {
  const user = await getCurrentUser()
  const customObservationsEnabled = isMatchDayCustomObservationsEnabled()
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
  const recordableEventOptions = await getActiveRecordableEventDefinitions({
    legacyOnly: false,
    clubIds: Array.from(new Set(teams.map((team) => team.clubId))),
  })
  const matchPhaseGroups = getRecordableEventPhaseGroups(recordableEventOptions)
  const previousMatches = await prisma.matchDay.findMany({
    where: { teamId: { in: teams.map((team) => team.id) } },
    include: {
      team: { include: { club: true } },
      matchDayEventTypes: { include: { eventDefinition: true, clubTrackingDefinition: customObservationsEnabled }, orderBy: { createdAt: 'asc' } },
      matchDayPlayers: { include: { player: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { kickoffAt: 'desc' },
    take: 24,
  })
  const customObservationsByTeamId = customObservationsEnabled
    ? Object.fromEntries(await Promise.all(teams.map(async (team) => {
        try {
          const result = await getActiveSelectableCustomObservationsForTeam({ userId: user.id, teamId: team.id })
          if (!result.ok) return [team.id, { state: 'error' as const, observations: [], error: customObservationLoadErrorMessage }]
          return [team.id, {
            state: 'loaded' as const,
            observations: result.value.map((observation) => ({
              id: observation.id,
              clubId: observation.clubId,
              teamId: observation.teamId,
              visibilityScope: observation.visibilityScope,
              label: observation.label,
              normalizedName: observation.normalizedName,
              countingDefinition: observation.countingDefinition,
              guidance: observation.guidance,
              category: observation.category,
              categoryLabel: observation.categoryLabel,
              polarity: observation.polarity,
              requiresLocation: observation.requiresLocation,
              sourceLabel: observation.sourceLabel,
            })),
            error: null,
          }]
        } catch {
          return [team.id, { state: 'error' as const, observations: [], error: customObservationLoadErrorMessage }]
        }
      })))
    : {}

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/match-day" className="text-sm font-semibold text-blue-800 hover:underline">
        Back to Match Day
      </Link>
      <PageHeader title="Create Match Day" description="Set up only what helps coaching observation and review." />
      <MatchDayWizard
        teams={teams.map((team) => ({
          id: team.id,
          clubId: team.clubId,
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
            scope: event.scope,
            clubId: event.clubId,
            label: event.label,
            slug: event.slug,
            normalizedName: event.normalizedName,
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
        previousSetups={previousMatches.map((match) => ({
          id: match.id,
          teamId: match.teamId,
          teamName: match.team.name,
          clubName: match.team.club.name,
          opposition: match.opposition,
          kickoffAt: match.kickoffAt.toISOString(),
          eventTrackingScope: match.eventTrackingScope,
          trackPlayerMinutes: match.trackPlayerMinutes,
          locationTrackingEnabled: match.matchDayEventTypes.some((eventType) => eventType.eventDefinition?.requiresLocation || (customObservationsEnabled && eventType.clubTrackingDefinition?.requiresLocation)),
          selectedEventDefinitionIds: match.matchDayEventTypes
            .map((eventType) => eventType.eventDefinitionId)
            .filter((eventDefinitionId): eventDefinitionId is string => Boolean(eventDefinitionId)),
          eventLabels: match.matchDayEventTypes.map((eventType) => eventType.eventDefinition?.name ?? eventType.clubTrackingDefinition?.name ?? eventType.eventType ?? 'Unavailable observation'),
          selectedClubTrackingDefinitionIds: customObservationsEnabled
            ? match.matchDayEventTypes
                .map((eventType) => eventType.clubTrackingDefinitionId)
                .filter((clubTrackingDefinitionId): clubTrackingDefinitionId is string => Boolean(clubTrackingDefinitionId))
            : [],
          players: match.matchDayPlayers.map((matchPlayer) => ({
            playerId: matchPlayer.playerId,
            playerName: `${matchPlayer.player.firstName} ${matchPlayer.player.surname}`,
            squadStatus: matchPlayer.squadStatus,
            startingPosition: matchPlayer.startingPosition,
            shirtNumberSnapshot: matchPlayer.shirtNumberSnapshot,
            isTracked: matchPlayer.isTracked,
          })),
        }))}
        customObservationsEnabled={customObservationsEnabled}
        customObservationsByTeamId={customObservationsByTeamId}
        maxCustomObservations={MAX_CLASSIC_CUSTOM_OBSERVATIONS}
        createCustomObservationAction={createCustomObservationAction}
        checkCustomObservationConflictsAction={checkCustomObservationConflictsAction}
        validateTemplateAction={validateTemplateForTeam}
        createAction={createMatchFromWizard}
      />
    </main>
  )
}
