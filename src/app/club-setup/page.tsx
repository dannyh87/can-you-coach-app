import Link from 'next/link'
import ClubSetupClient from '@/app/club-setup/ClubSetupClient'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser, isClerkEnabled } from '@/lib/auth'
import { matchDayGroupOptions } from '@/lib/eventDefinitions'
import { createEventDefinitionSlug, normalizeEventDefinitionName } from '@/lib/eventDefinitionSimilarity'
import { ensureDefaultClub } from '@/lib/localUser'
import { isOwnerForClub } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

type SetupActionResult =
  | { ok: true }
  | { ok: false; reason: string }

const matchPhaseOptions = [
  { value: 'IN_POSSESSION', label: 'In possession' },
  { value: 'OUT_OF_POSSESSION', label: 'Out of possession' },
  { value: 'TRANSITION', label: 'Transition' },
  { value: 'SET_PIECES', label: 'Set pieces' },
  { value: 'DISCIPLINE_MATCH_ADMIN', label: 'Discipline / Match admin' },
] as const

const categoryOptions = [
  { value: 'PASSING', label: 'Passing' },
  { value: 'RECEIVING', label: 'Receiving' },
  { value: 'DRIBBLING_1V1', label: 'Dribbling / 1v1' },
  { value: 'SHOOTING', label: 'Shooting' },
  { value: 'DEFENDING', label: 'Defending' },
  { value: 'GOALKEEPING', label: 'Goalkeeping' },
  { value: 'DISCIPLINE', label: 'Discipline' },
  { value: 'INJURIES', label: 'Injuries' },
  { value: 'OTHER', label: 'Other' },
] as const

const agePhaseOptions = [
  { value: 'FOUNDATION', label: 'Foundation U6-U11' },
  { value: 'YOUTH', label: 'Youth U12-U18' },
  { value: 'ADULT', label: 'Adult / Open Age' },
] as const

const fourCornerOptions = [
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'TACTICAL', label: 'Tactical' },
  { value: 'PHYSICAL', label: 'Physical' },
  { value: 'PSYCHOLOGICAL_SOCIAL', label: 'Psychological / Social' },
] as const

const positionOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'GOALKEEPER', label: 'Goalkeeper' },
  { value: 'DEFENDER', label: 'Defender' },
  { value: 'MIDFIELDER', label: 'Midfielder' },
  { value: 'FORWARD', label: 'Forward' },
  { value: 'WIDE_PLAYER', label: 'Wide player' },
  { value: 'CENTRAL_PLAYER', label: 'Central player' },
] as const

const matchPhaseValues = matchPhaseOptions.map((option) => option.value)
const categoryValues = categoryOptions.map((option) => option.value)
const agePhaseValues = agePhaseOptions.map((option) => option.value)
const fourCornerValues = fourCornerOptions.map((option) => option.value)
const positionValues = positionOptions.map((option) => option.value)
const matchDayGroupValues = matchDayGroupOptions.map((option) => option.value)

const getCheckedValues = <T extends string>(formData: FormData, key: string, allowedValues: readonly T[]) => {
  const allowed = new Set<string>(allowedValues)

  return Array.from(new Set(
    formData
      .getAll(key)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => allowed.has(value))
  )) as T[]
}

const getOptionalMatchDayGroupValue = (formData: FormData) => {
  const matchDayGroup = getTextValue(formData, 'matchDayGroup')
  return matchDayGroupValues.includes(matchDayGroup as (typeof matchDayGroupValues)[number])
    ? matchDayGroup as (typeof matchDayGroupValues)[number]
    : null
}

const getOptionalUrlValue = (value: string) => {
  if (!value) return { ok: true as const, value: null }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false as const, reason: 'Video URL must start with http:// or https://.' }
    }

    return { ok: true as const, value }
  } catch {
    return { ok: false as const, reason: 'Video URL is invalid.' }
  }
}

async function createUniqueClubEventSlug(name: string, clubId: string, excludeId?: string) {
  const baseSlug = createEventDefinitionSlug(name)
  let candidateSlug = baseSlug
  let suffix = 2

  while (true) {
    const existing = await prisma.eventDefinition.findFirst({
      where: {
        scope: 'CLUB',
        clubId,
        slug: candidateSlug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!existing) return candidateSlug

    candidateSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

async function validateClubEventForm(formData: FormData, userId: string, existingEventId?: string) {
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const description = getTextValue(formData, 'description')
  const subcategory = getTextValue(formData, 'subcategory')
  const videoUrlInput = getTextValue(formData, 'videoUrl')
  const matchPhase = getTextValue(formData, 'matchPhase')
  const category = getTextValue(formData, 'category')
  const fourCorner = getTextValue(formData, 'fourCorner')
  const matchDayGroup = getOptionalMatchDayGroupValue(formData)
  const agePhases = getCheckedValues(formData, 'agePhase', agePhaseValues)
  const positionRelevance = getCheckedValues(formData, 'positionRelevance', positionValues)
  const videoUrl = getOptionalUrlValue(videoUrlInput)

  if (!clubId) return { ok: false as const, reason: 'Missing club.' }
  if (!(await isOwnerForClub(userId, clubId))) return { ok: false as const, reason: 'You cannot manage events for this club.' }
  if (!name) return { ok: false as const, reason: 'Event name is required.' }
  if (!videoUrl.ok) return { ok: false as const, reason: videoUrl.reason }
  if (!matchPhaseValues.includes(matchPhase as (typeof matchPhaseValues)[number])) return { ok: false as const, reason: 'Match phase is invalid.' }
  if (!categoryValues.includes(category as (typeof categoryValues)[number])) return { ok: false as const, reason: 'Category is invalid.' }
  if (!fourCornerValues.includes(fourCorner as (typeof fourCornerValues)[number])) return { ok: false as const, reason: '4 Corner category is invalid.' }
  if (agePhases.length === 0) return { ok: false as const, reason: 'Select at least one age phase.' }
  if (positionRelevance.length === 0) return { ok: false as const, reason: 'Select at least one position relevance.' }

  const normalizedName = normalizeEventDefinitionName(name)
  const globalDuplicate = await prisma.eventDefinition.findFirst({
    where: { scope: 'GLOBAL', normalizedName },
    select: { id: true },
  })
  if (globalDuplicate) {
    return { ok: false as const, reason: 'This already exists as a global event. Use the global event or choose a different name.' }
  }

  const clubDuplicate = await prisma.eventDefinition.findFirst({
    where: {
      scope: 'CLUB',
      clubId,
      normalizedName,
      ...(existingEventId ? { id: { not: existingEventId } } : {}),
    },
    select: { id: true },
  })
  if (clubDuplicate) return { ok: false as const, reason: 'This club already has an event with a similar name.' }

  return {
    ok: true as const,
    clubId,
    name,
    normalizedName,
    description: description || null,
    subcategory: subcategory || null,
    videoUrl: videoUrl.value,
    matchPhase: matchPhase as (typeof matchPhaseValues)[number],
    category: category as (typeof categoryValues)[number],
    matchDayGroup,
    agePhases,
    fourCorner: fourCorner as (typeof fourCornerValues)[number],
    positionRelevance,
    enabledByDefault: formData.get('enabledByDefault') === 'on',
    benchmarkable: formData.get('benchmarkable') === 'on',
    requiresLocation: formData.get('requiresLocation') === 'on',
  }
}

async function createClub(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const name = getTextValue(formData, 'name')

  if (!name) return { ok: false, reason: 'Club name is required.' }

  const membershipCount = await prisma.clubMembership.count({ where: { userId: user.id } })
  if (membershipCount > 0) {
    return {
      ok: false,
      reason: 'Club creation is only available before you have club access. Ask a club admin to update your role if you need setup access.',
    }
  }

  await prisma.$transaction(async (tx) => {
    const club = await tx.club.create({
      data: {
        userId: user.id,
        name,
      },
    })

    await tx.clubMembership.create({
      data: {
        userId: user.id,
        clubId: club.id,
        role: 'OWNER',
      },
    })
  })

  revalidatePath('/club-setup')
  revalidatePath('/')
  return { ok: true }
}

async function updateClub(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')
  const name = getTextValue(formData, 'name')
  const location = getTextValue(formData, 'location')
  const notes = getTextValue(formData, 'notes')

  if (!id || !name) {
    return { ok: false, reason: 'Club name is required.' }
  }

  if (!(await isOwnerForClub(user.id, id))) {
    return { ok: false, reason: 'You cannot update this club.' }
  }

  await prisma.club.update({
    where: { id },
    data: {
      name,
      location: location || null,
      notes: notes || null,
    },
  })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function createTeam(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')
  const league = getTextValue(formData, 'league')
  const footballPyramidStep = getTextValue(formData, 'footballPyramidStep')

  if (!clubId || !name || !ageGroup || !season) {
    return { ok: false, reason: 'Club, team name, age group and season are required.' }
  }

  if (!(await isOwnerForClub(user.id, clubId))) {
    return { ok: false, reason: 'You cannot add a team to this club.' }
  }

  await prisma.team.create({
    data: {
      clubId,
      name,
      ageGroup,
      season,
      league: league || null,
      footballPyramidStep: footballPyramidStep || null,
    },
  })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function updateTeam(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')
  const clubId = getTextValue(formData, 'clubId')
  const name = getTextValue(formData, 'name')
  const ageGroup = getTextValue(formData, 'ageGroup')
  const season = getTextValue(formData, 'season')
  const league = getTextValue(formData, 'league')
  const footballPyramidStep = getTextValue(formData, 'footballPyramidStep')

  if (!id || !clubId || !name || !ageGroup || !season) {
    return { ok: false, reason: 'Club, team name, age group and season are required.' }
  }

  if (!(await isOwnerForClub(user.id, clubId))) {
    return { ok: false, reason: 'You cannot move this team to that club.' }
  }

  const team = await prisma.team.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
      clubId: true,
    },
  })

  if (!team || !(await isOwnerForClub(user.id, team.clubId))) {
    return { ok: false, reason: 'Team was not found.' }
  }

  await prisma.team.update({
    where: { id },
    data: {
      clubId,
      name,
      ageGroup,
      season,
      league: league || null,
      footballPyramidStep: footballPyramidStep || null,
    },
  })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function deleteTeam(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'id')

  if (!id) return { ok: false, reason: 'Missing team.' }

  const team = await prisma.team.findFirst({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          players: true,
          fitnessTestSessions: true,
          matchDays: true,
        },
      },
    },
  })

  if (!team || !(await isOwnerForClub(user.id, team.clubId))) {
    return { ok: false, reason: 'Team was not found.' }
  }

  if (
    team._count.players > 0 ||
    team._count.fitnessTestSessions > 0 ||
    team._count.matchDays > 0
  ) {
    return {
      ok: false,
      reason: 'This team has players, fitness sessions or match days. Move or remove them before deleting.',
    }
  }

  await prisma.team.delete({ where: { id } })

  revalidatePath('/club-setup')
  revalidatePath('/players')
  return { ok: true }
}

async function createClubEvent(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const eventData = await validateClubEventForm(formData, user.id)
  if (!eventData.ok) return { ok: false, reason: eventData.reason }

  await prisma.eventDefinition.create({
    data: {
      scope: 'CLUB',
      clubId: eventData.clubId,
      createdByUserId: user.id,
      legacyEventType: null,
      name: eventData.name,
      slug: await createUniqueClubEventSlug(eventData.name, eventData.clubId),
      normalizedName: eventData.normalizedName,
      description: eventData.description,
      subcategory: eventData.subcategory,
      videoUrl: eventData.videoUrl,
      matchPhase: eventData.matchPhase,
      category: eventData.category,
      matchDayGroup: eventData.matchDayGroup,
      agePhases: eventData.agePhases,
      fourCorner: eventData.fourCorner,
      positionRelevance: eventData.positionRelevance,
      enabledByDefault: eventData.enabledByDefault,
      benchmarkable: eventData.benchmarkable,
      requiresLocation: eventData.requiresLocation,
      isActive: true,
    },
  })

  revalidatePath('/club-setup')
  return { ok: true }
}

async function updateClubEvent(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'eventDefinitionId')
  if (!id) return { ok: false, reason: 'Missing event definition.' }

  const existing = await prisma.eventDefinition.findFirst({
    where: { id, scope: 'CLUB' },
    include: {
      _count: {
        select: {
          matchDayEventTypes: true,
          matchEvents: true,
        },
      },
    },
  })
  if (!existing) return { ok: false, reason: 'Club event was not found.' }
  if (!(await isOwnerForClub(user.id, existing.clubId ?? ''))) return { ok: false, reason: 'You cannot manage this club event.' }
  if (existing._count.matchDayEventTypes > 0 || existing._count.matchEvents > 0) {
    return { ok: false, reason: 'This event has already been used. Archive it instead of editing its details.' }
  }

  const eventData = await validateClubEventForm(formData, user.id, id)
  if (!eventData.ok) return { ok: false, reason: eventData.reason }
  if (eventData.clubId !== existing.clubId) return { ok: false, reason: 'Club event cannot be moved between clubs.' }

  await prisma.eventDefinition.update({
    where: { id },
    data: {
      name: eventData.name,
      slug: await createUniqueClubEventSlug(eventData.name, eventData.clubId, id),
      normalizedName: eventData.normalizedName,
      description: eventData.description,
      subcategory: eventData.subcategory,
      videoUrl: eventData.videoUrl,
      matchPhase: eventData.matchPhase,
      category: eventData.category,
      matchDayGroup: eventData.matchDayGroup,
      agePhases: eventData.agePhases,
      fourCorner: eventData.fourCorner,
      positionRelevance: eventData.positionRelevance,
      enabledByDefault: existing.isActive && eventData.enabledByDefault,
      benchmarkable: eventData.benchmarkable,
      requiresLocation: eventData.requiresLocation,
    },
  })

  revalidatePath('/club-setup')
  return { ok: true }
}

async function archiveClubEvent(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'eventDefinitionId')
  if (!id) return { ok: false, reason: 'Missing event definition.' }

  const eventDefinition = await prisma.eventDefinition.findFirst({
    where: { id, scope: 'CLUB' },
    select: { clubId: true },
  })
  if (!eventDefinition || !(await isOwnerForClub(user.id, eventDefinition.clubId ?? ''))) {
    return { ok: false, reason: 'Club event was not found.' }
  }

  await prisma.eventDefinition.update({
    where: { id },
    data: {
      isActive: false,
      archivedAt: new Date(),
      enabledByDefault: false,
    },
  })

  revalidatePath('/club-setup')
  return { ok: true }
}

async function restoreClubEvent(formData: FormData): Promise<SetupActionResult> {
  'use server'

  const user = await getCurrentUser()
  const id = getTextValue(formData, 'eventDefinitionId')
  if (!id) return { ok: false, reason: 'Missing event definition.' }

  const eventDefinition = await prisma.eventDefinition.findFirst({
    where: { id, scope: 'CLUB' },
    select: { clubId: true },
  })
  if (!eventDefinition || !(await isOwnerForClub(user.id, eventDefinition.clubId ?? ''))) {
    return { ok: false, reason: 'Club event was not found.' }
  }

  await prisma.eventDefinition.update({
    where: { id },
    data: {
      isActive: true,
      archivedAt: null,
    },
  })

  revalidatePath('/club-setup')
  return { ok: true }
}

export default async function ClubSetupPage() {
  const user = await getCurrentUser()
  if (!isClerkEnabled()) await ensureDefaultClub(user.id)

  const [ownerMemberships, totalMembershipCount] = await Promise.all([
    prisma.clubMembership.findMany({
      where: {
        userId: user.id,
        role: 'OWNER',
      },
      select: { clubId: true },
    }),
    prisma.clubMembership.count({ where: { userId: user.id } }),
  ])

  const clubs = await prisma.club.findMany({
    where: {
      id: {
        in: ownerMemberships.map((membership) => membership.clubId),
      },
    },
    include: {
      teams: {
        include: {
          _count: {
            select: {
              players: true,
              fitnessTestSessions: true,
              matchDays: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const clubEvents = await prisma.eventDefinition.findMany({
    where: {
      scope: 'CLUB',
      clubId: { in: clubs.map((club) => club.id) },
    },
    include: {
      _count: {
        select: {
          matchDayEventTypes: true,
          matchEvents: true,
        },
      },
    },
    orderBy: [
      { isActive: 'desc' },
      { matchDayGroup: 'asc' },
      { category: 'asc' },
      { name: 'asc' },
    ],
  })

  const clubRows = clubs.map((club) => ({
    id: club.id,
    name: club.name,
    location: club.location,
    notes: club.notes,
    teams: club.teams.map((team) => ({
      id: team.id,
      clubId: team.clubId,
      clubName: club.name,
      name: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      league: team.league,
      footballPyramidStep: team.footballPyramidStep,
      playerCount: team._count.players,
      fitnessSessionCount: team._count.fitnessTestSessions,
      matchDayCount: team._count.matchDays,
    })),
  }))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Club Setup"
        description="Add your club and teams once so the rest of the app is ready to use."
      />
      {clubRows.length > 0 && (
        <Link
          href="/club-setup/access"
          className="mb-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          Manage access
        </Link>
      )}

      <ClubSetupClient
        clubs={clubRows}
        clubEvents={clubEvents.map((eventDefinition) => ({
          id: eventDefinition.id,
          clubId: eventDefinition.clubId ?? '',
          name: eventDefinition.name,
          description: eventDefinition.description,
          subcategory: eventDefinition.subcategory,
          videoUrl: eventDefinition.videoUrl,
          matchPhase: eventDefinition.matchPhase,
          category: eventDefinition.category,
          matchDayGroup: eventDefinition.matchDayGroup,
          agePhases: eventDefinition.agePhases,
          fourCorner: eventDefinition.fourCorner,
          positionRelevance: eventDefinition.positionRelevance,
          enabledByDefault: eventDefinition.enabledByDefault,
          benchmarkable: eventDefinition.benchmarkable,
          requiresLocation: eventDefinition.requiresLocation,
          isActive: eventDefinition.isActive,
          usedCount: eventDefinition._count.matchDayEventTypes + eventDefinition._count.matchEvents,
        }))}
        canCreateFirstClub={totalMembershipCount === 0}
        matchPhaseOptions={matchPhaseOptions}
        categoryOptions={categoryOptions}
        matchDayGroupOptions={matchDayGroupOptions}
        agePhaseOptions={agePhaseOptions}
        fourCornerOptions={fourCornerOptions}
        positionOptions={positionOptions}
        createClubAction={createClub}
        updateClubAction={updateClub}
        createTeamAction={createTeam}
        updateTeamAction={updateTeam}
        deleteTeamAction={deleteTeam}
        createClubEventAction={createClubEvent}
        updateClubEventAction={updateClubEvent}
        archiveClubEventAction={archiveClubEvent}
        restoreClubEventAction={restoreClubEvent}
      />
    </main>
  )
}
