import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import type { TrackingFocusArea, TrackingTopicPhase } from '@prisma/client'

import MatchDayV2SetupWizard from '@/app/match-day/new-v2/MatchDayV2SetupWizard'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import {
  copyPreviousMatchTrackingTaskV2,
  createDraftMatchDayV2,
  createGuidedMatchTrackingTaskV2,
  assignMatchTrackingTaskV2,
  applyPlayerTrackingTaskToPlayersV2,
  cancelMatchTrackingAssignmentV2,
  getEligibleContributorsForTaskV2,
  getMatchDayV2SetupState,
  publishMatchDayV2Setup,
  saveMatchDayV2Squad,
  updateDraftMatchDayV2,
} from '@/lib/matchDayV2Setup'
import {
  getNextTrackingQuestion,
  getRecommendedEventsForTopic,
  resolveTrackingSetup,
  searchTrackingTopics,
  type TrackingResolverContext,
} from '@/lib/matchTrackingResolver'
import { getPreviousTrackingTasksForCopy } from '@/lib/matchTrackingQueries'
import { inferAgePhase } from '@/lib/matchEventTaxonomy'
import { canManageMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
type SetupStatePayload = Extract<Awaited<ReturnType<typeof getMatchDayV2SetupState>>, { ok: true }>['value']
type EligibleContributorsPayload = Extract<Awaited<ReturnType<typeof getEligibleContributorsForTaskV2>>, { ok: true }>['value']
type PublishPayload = Extract<Awaited<ReturnType<typeof publishMatchDayV2Setup>>, { ok: true }>['value']

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getOptionalText = (formData: FormData, key: string) => getText(formData, key) || null

const getSelectedIds = (formData: FormData, key: string) =>
  Array.from(new Set(formData.getAll(key).filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)))

async function requireV2User() {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  return getCurrentUser()
}

const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data })
const fail = (message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> => ({ ok: false, message, fieldErrors })

async function createDraftAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  'use server'

  const user = await requireV2User()
  const result = await createDraftMatchDayV2({
    userId: user.id,
    teamId: getText(formData, 'teamId'),
    date: getText(formData, 'date'),
    kickoffTime: getText(formData, 'kickoffTime'),
    opposition: getText(formData, 'opposition'),
    matchType: getText(formData, 'matchType'),
    venue: getText(formData, 'venue'),
  })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath('/match-day')
  return ok(result.value)
}

async function updateDraftAction(formData: FormData): Promise<ActionResult> {
  'use server'

  const user = await requireV2User()
  const result = await updateDraftMatchDayV2({
    userId: user.id,
    matchDayId: getText(formData, 'matchDayId'),
    date: getText(formData, 'date'),
    kickoffTime: getText(formData, 'kickoffTime'),
    opposition: getText(formData, 'opposition'),
    matchType: getText(formData, 'matchType'),
    venue: getText(formData, 'venue'),
  })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath('/match-day')
  revalidatePath(`/match-day/${getText(formData, 'matchDayId')}`)
  return ok(undefined)
}

async function saveSquadAction(formData: FormData): Promise<ActionResult> {
  'use server'

  const user = await requireV2User()
  const players = getSelectedIds(formData, 'playerId').map((playerId) => ({
    playerId,
    squadStatus: getText(formData, `squadStatus:${playerId}`) as 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED',
    startingPosition: getOptionalText(formData, `startingPosition:${playerId}`),
  }))
  const result = await saveMatchDayV2Squad({ userId: user.id, matchDayId: getText(formData, 'matchDayId'), players })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath(`/match-day/${getText(formData, 'matchDayId')}`)
  return ok(undefined)
}

async function resolveTrackingAction(context: TrackingResolverContext): Promise<ActionResult<Awaited<ReturnType<typeof resolveTrackingSetup>>>> {
  'use server'

  await requireV2User()
  return ok(await resolveTrackingSetup(context))
}

async function nextTrackingQuestionAction(context: TrackingResolverContext): Promise<ActionResult<Awaited<ReturnType<typeof getNextTrackingQuestion>>>> {
  'use server'

  await requireV2User()
  return ok(await getNextTrackingQuestion(context))
}

async function searchTopicsAction(query: string, context: TrackingResolverContext): Promise<ActionResult<Awaited<ReturnType<typeof searchTrackingTopics>>>> {
  'use server'

  await requireV2User()
  return ok(await searchTrackingTopics(query, context))
}

async function getTopicEventsAction(topicId: string, context: TrackingResolverContext): Promise<ActionResult<Awaited<ReturnType<typeof getRecommendedEventsForTopic>>>> {
  'use server'

  await requireV2User()
  return ok(await getRecommendedEventsForTopic(topicId, context))
}

async function createTaskAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  'use server'

  const user = await requireV2User()
  const result = await createGuidedMatchTrackingTaskV2({
    userId: user.id,
    matchDayId: getText(formData, 'matchDayId'),
    scope: getText(formData, 'scope') as 'PLAYER' | 'UNIT' | 'TEAM',
    targetContext: getOptionalText(formData, 'targetContext') as TrackingResolverContext['targetContext'],
    phase: getText(formData, 'phase') as TrackingTopicPhase,
    focusArea: getText(formData, 'focusArea') as TrackingFocusArea,
    topicId: getText(formData, 'topicId'),
    selectedEventDefinitionIds: getSelectedIds(formData, 'eventDefinitionId'),
    playerId: getOptionalText(formData, 'playerId'),
    unitKey: getOptionalText(formData, 'unitKey'),
    unitLabel: getOptionalText(formData, 'unitLabel'),
    title: getText(formData, 'title'),
    instructions: getOptionalText(formData, 'instructions'),
  })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath(`/match-day/${getText(formData, 'matchDayId')}`)
  return ok(result.value)
}

async function getPreviousTasksAction(matchDayId: string): Promise<ActionResult<Array<{ id: string; title: string; matchLabel: string; scopeType: string; eventCount: number; requiresPlayer: boolean }>>> {
  'use server'

  const user = await requireV2User()
  if (!(await canManageMatchDay(user.id, matchDayId))) return fail('You cannot manage tracking tasks for this match.')
  const tasks = await getPreviousTrackingTasksForCopy(user.id, matchDayId)
  return ok(tasks.map((task) => ({
    id: task.id,
    title: task.title,
    matchLabel: `${task.matchDay.opposition} · ${new Intl.DateTimeFormat('en-GB').format(task.matchDay.kickoffAt)}`,
    scopeType: task.scopeType,
    eventCount: task.events.length,
    requiresPlayer: task.scopeType === 'PLAYER',
  })))
}

async function copyTaskAction(formData: FormData): Promise<ActionResult<{ id: string; requiresPlayerSelection: boolean; missingEventIds: string[] }>> {
  'use server'

  const user = await requireV2User()
  const result = await copyPreviousMatchTrackingTaskV2({
    userId: user.id,
    sourceTaskId: getText(formData, 'sourceTaskId'),
    destinationMatchDayId: getText(formData, 'destinationMatchDayId'),
    destinationPlayerId: getOptionalText(formData, 'destinationPlayerId'),
  })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath(`/match-day/${getText(formData, 'destinationMatchDayId')}`)
  return ok(result.value)
}

async function getSetupStateAction(matchDayId: string): Promise<ActionResult<SetupStatePayload>> {
  'use server'

  const user = await requireV2User()
  const result = await getMatchDayV2SetupState({ userId: user.id, matchDayId })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  return ok(result.value)
}

async function getEligibleContributorsAction(trackingTaskId: string): Promise<ActionResult<EligibleContributorsPayload>> {
  'use server'

  const user = await requireV2User()
  const result = await getEligibleContributorsForTaskV2({ userId: user.id, trackingTaskId })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  return ok(result.value)
}

async function assignTaskAction(formData: FormData): Promise<ActionResult<{ id: string | null; alreadyExisted: boolean }>> {
  'use server'

  const user = await requireV2User()
  const result = await assignMatchTrackingTaskV2({
    userId: user.id,
    trackingTaskId: getText(formData, 'trackingTaskId'),
    method: getText(formData, 'method') as 'SELF' | 'DIRECT' | 'GROUP_OFFER' | 'LATER',
    assignedUserId: getOptionalText(formData, 'assignedUserId'),
    recipientUserIds: getSelectedIds(formData, 'recipientUserId'),
  })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath('/my-assignments')
  revalidatePath('/notifications')
  return ok(result.value)
}

async function cancelAssignmentAction(formData: FormData): Promise<ActionResult> {
  'use server'

  const user = await requireV2User()
  const result = await cancelMatchTrackingAssignmentV2({ userId: user.id, assignmentId: getText(formData, 'assignmentId') })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath('/my-assignments')
  revalidatePath('/notifications')
  return ok(undefined)
}

async function applyToPlayersAction(formData: FormData): Promise<ActionResult<{ ids: string[] }>> {
  'use server'

  const user = await requireV2User()
  const result = await applyPlayerTrackingTaskToPlayersV2({ userId: user.id, sourceTaskId: getText(formData, 'sourceTaskId'), playerIds: getSelectedIds(formData, 'playerId') })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  return ok(result.value)
}

async function publishSetupAction(matchDayId: string): Promise<ActionResult<PublishPayload>> {
  'use server'

  const user = await requireV2User()
  const result = await publishMatchDayV2Setup({ userId: user.id, matchDayId })
  if (!result.ok) return fail(result.reason, result.fieldErrors)
  revalidatePath(`/match-day/${matchDayId}`)
  revalidatePath('/match-day')
  revalidatePath('/my-assignments')
  revalidatePath('/notifications')
  return ok(result.value)
}

export default async function NewMatchDayV2Page() {
  const user = await requireV2User()
  const manageableTeamIds = await getManageableTeamIds(user.id)
  if (manageableTeamIds.length === 0) notFound()

  const teams = await prisma.team.findMany({
    where: { AND: [await accessibleTeamWhere(user.id), { id: { in: manageableTeamIds } }] },
    include: {
      club: true,
      players: { where: { isActive: true }, orderBy: [{ surname: 'asc' }, { firstName: 'asc' }] },
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })
  if (teams.length === 0) notFound()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <Link href="/match-day" className="text-sm font-semibold text-blue-800 hover:underline">
        Back to Match Day
      </Link>
      <PageHeader title="New Match Day setup" description="Create the match, shape the squad, and turn coaching topics into focused tracking tasks." />
      <MatchDayV2SetupWizard
        teams={teams.map((team) => {
          const agePhase = inferAgePhase(team.ageGroup)
          return {
            id: team.id,
            clubId: team.clubId,
            name: team.name,
            clubName: team.club.name,
            ageGroup: team.ageGroup,
            agePhase: agePhase === 'ALL' ? undefined : agePhase,
            players: team.players.map((player) => ({
              id: player.id,
              name: `${player.firstName} ${player.surname}`,
              squadNumber: player.squadNumber,
              preferredPosition: player.preferredPosition,
            })),
          }
        })}
        createDraftAction={createDraftAction}
        updateDraftAction={updateDraftAction}
        saveSquadAction={saveSquadAction}
        resolveTrackingAction={resolveTrackingAction}
        nextTrackingQuestionAction={nextTrackingQuestionAction}
        searchTopicsAction={searchTopicsAction}
        getTopicEventsAction={getTopicEventsAction}
        createTaskAction={createTaskAction}
        getPreviousTasksAction={getPreviousTasksAction}
        copyTaskAction={copyTaskAction}
        getSetupStateAction={getSetupStateAction}
        getEligibleContributorsAction={getEligibleContributorsAction}
        assignTaskAction={assignTaskAction}
        cancelAssignmentAction={cancelAssignmentAction}
        applyToPlayersAction={applyToPlayersAction}
        publishSetupAction={publishSetupAction}
      />
    </main>
  )
}
