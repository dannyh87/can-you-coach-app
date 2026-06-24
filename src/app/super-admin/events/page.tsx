import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import EventLibraryClient from '@/app/super-admin/events/EventLibraryClient'
import { normalizeEventDefinitionName, createEventDefinitionSlug } from '@/lib/eventDefinitionSimilarity'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'

export const dynamic = 'force-dynamic'

type EventDefinitionActionResult =
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

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

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

const matchPhaseValues = matchPhaseOptions.map((option) => option.value)
const categoryValues = categoryOptions.map((option) => option.value)
const agePhaseValues = agePhaseOptions.map((option) => option.value)
const fourCornerValues = fourCornerOptions.map((option) => option.value)
const positionValues = positionOptions.map((option) => option.value)

async function requireSuperAdmin(): Promise<EventDefinitionActionResult> {
  const user = await getCurrentUser()

  if (!canManageGlobalEventLibrary(user)) {
    return { ok: false, reason: 'You do not have permission to manage global event definitions.' }
  }

  return { ok: true }
}

async function createUniqueSlug(name: string, excludeId?: string) {
  const baseSlug = createEventDefinitionSlug(name)
  let candidateSlug = baseSlug
  let suffix = 2

  while (true) {
    const existing = await prisma.eventDefinition.findUnique({
      where: { slug: candidateSlug },
      select: { id: true },
    })

    if (!existing || existing.id === excludeId) return candidateSlug

    candidateSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

async function createEventDefinition(formData: FormData): Promise<EventDefinitionActionResult> {
  'use server'

  const permission = await requireSuperAdmin()
  if (!permission.ok) return permission

  const name = getTextValue(formData, 'name')
  const description = getTextValue(formData, 'description')
  const matchPhase = getTextValue(formData, 'matchPhase')
  const category = getTextValue(formData, 'category')
  const fourCorner = getTextValue(formData, 'fourCorner')
  const agePhases = getCheckedValues(formData, 'agePhase', agePhaseValues)
  const positionRelevance = getCheckedValues(formData, 'positionRelevance', positionValues)

  if (!name) return { ok: false, reason: 'Event name is required.' }
  if (!matchPhaseValues.includes(matchPhase as (typeof matchPhaseValues)[number])) {
    return { ok: false, reason: 'Match phase is invalid.' }
  }
  if (!categoryValues.includes(category as (typeof categoryValues)[number])) {
    return { ok: false, reason: 'Category is invalid.' }
  }
  if (!fourCornerValues.includes(fourCorner as (typeof fourCornerValues)[number])) {
    return { ok: false, reason: '4 Corner category is invalid.' }
  }
  if (agePhases.length === 0) return { ok: false, reason: 'Select at least one age phase.' }
  if (positionRelevance.length === 0) return { ok: false, reason: 'Select at least one position relevance.' }

  const normalizedName = normalizeEventDefinitionName(name)
  const duplicate = await prisma.eventDefinition.findUnique({
    where: { normalizedName },
    select: { name: true },
  })

  if (duplicate) {
    return { ok: false, reason: `This looks like an existing event: ${duplicate.name}. Use the existing event or rename this one.` }
  }

  await prisma.eventDefinition.create({
    data: {
      scope: 'GLOBAL',
      name,
      slug: await createUniqueSlug(name),
      normalizedName,
      description: description || null,
      matchPhase: matchPhase as (typeof matchPhaseValues)[number],
      category: category as (typeof categoryValues)[number],
      agePhases,
      fourCorner: fourCorner as (typeof fourCornerValues)[number],
      positionRelevance,
      enabledByDefault: formData.get('enabledByDefault') === 'on',
      benchmarkable: formData.get('benchmarkable') === 'on',
      isActive: true,
    },
  })

  revalidatePath('/super-admin/events')
  return { ok: true }
}

async function updateEventDefinition(formData: FormData): Promise<EventDefinitionActionResult> {
  'use server'

  const permission = await requireSuperAdmin()
  if (!permission.ok) return permission

  const id = getTextValue(formData, 'eventDefinitionId')
  const name = getTextValue(formData, 'name')
  const description = getTextValue(formData, 'description')
  const matchPhase = getTextValue(formData, 'matchPhase')
  const category = getTextValue(formData, 'category')
  const fourCorner = getTextValue(formData, 'fourCorner')
  const agePhases = getCheckedValues(formData, 'agePhase', agePhaseValues)
  const positionRelevance = getCheckedValues(formData, 'positionRelevance', positionValues)

  if (!id) return { ok: false, reason: 'Missing event definition.' }
  if (!name) return { ok: false, reason: 'Event name is required.' }
  if (!matchPhaseValues.includes(matchPhase as (typeof matchPhaseValues)[number])) {
    return { ok: false, reason: 'Match phase is invalid.' }
  }
  if (!categoryValues.includes(category as (typeof categoryValues)[number])) {
    return { ok: false, reason: 'Category is invalid.' }
  }
  if (!fourCornerValues.includes(fourCorner as (typeof fourCornerValues)[number])) {
    return { ok: false, reason: '4 Corner category is invalid.' }
  }
  if (agePhases.length === 0) return { ok: false, reason: 'Select at least one age phase.' }
  if (positionRelevance.length === 0) return { ok: false, reason: 'Select at least one position relevance.' }

  const existing = await prisma.eventDefinition.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  })
  if (!existing) return { ok: false, reason: 'Event definition was not found.' }

  const normalizedName = normalizeEventDefinitionName(name)
  const duplicate = await prisma.eventDefinition.findUnique({
    where: { normalizedName },
    select: { id: true, name: true },
  })

  if (duplicate && duplicate.id !== id) {
    return { ok: false, reason: `This looks like an existing event: ${duplicate.name}. Use the existing event or rename this one.` }
  }

  await prisma.eventDefinition.update({
    where: { id },
    data: {
      name,
      slug: await createUniqueSlug(name, id),
      normalizedName,
      description: description || null,
      matchPhase: matchPhase as (typeof matchPhaseValues)[number],
      category: category as (typeof categoryValues)[number],
      agePhases,
      fourCorner: fourCorner as (typeof fourCornerValues)[number],
      positionRelevance,
      enabledByDefault: existing.isActive && formData.get('enabledByDefault') === 'on',
      benchmarkable: formData.get('benchmarkable') === 'on',
    },
  })

  revalidatePath('/super-admin/events')
  return { ok: true }
}

async function archiveEventDefinition(formData: FormData): Promise<EventDefinitionActionResult> {
  'use server'

  const permission = await requireSuperAdmin()
  if (!permission.ok) return permission

  const id = getTextValue(formData, 'eventDefinitionId')
  if (!id) return { ok: false, reason: 'Missing event definition.' }

  await prisma.eventDefinition.update({
    where: { id },
    data: {
      isActive: false,
      archivedAt: new Date(),
      enabledByDefault: false,
    },
  })

  revalidatePath('/super-admin/events')
  return { ok: true }
}

async function archiveEventDefinitions(formData: FormData): Promise<EventDefinitionActionResult> {
  'use server'

  const permission = await requireSuperAdmin()
  if (!permission.ok) return permission

  const eventDefinitionIds = Array.from(new Set(
    formData
      .getAll('eventDefinitionId')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  ))

  if (eventDefinitionIds.length === 0) {
    return { ok: false, reason: 'Select at least one event to archive.' }
  }

  await prisma.eventDefinition.updateMany({
    where: {
      id: { in: eventDefinitionIds },
      scope: 'GLOBAL',
      isActive: true,
    },
    data: {
      isActive: false,
      archivedAt: new Date(),
      enabledByDefault: false,
    },
  })

  revalidatePath('/super-admin/events')
  return { ok: true }
}

async function restoreEventDefinition(formData: FormData): Promise<EventDefinitionActionResult> {
  'use server'

  const permission = await requireSuperAdmin()
  if (!permission.ok) return permission

  const id = getTextValue(formData, 'eventDefinitionId')
  if (!id) return { ok: false, reason: 'Missing event definition.' }

  await prisma.eventDefinition.update({
    where: { id },
    data: {
      isActive: true,
      archivedAt: null,
      enabledByDefault: false,
    },
  })

  revalidatePath('/super-admin/events')
  return { ok: true }
}

export default async function SuperAdminEventsPage() {
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()

  const eventDefinitions = await prisma.eventDefinition.findMany({
    where: { scope: 'GLOBAL' },
    orderBy: [
      { isActive: 'desc' },
      { matchPhase: 'asc' },
      { category: 'asc' },
      { name: 'asc' },
    ],
  })

  return (
    <EventLibraryClient
      eventDefinitions={eventDefinitions.map((eventDefinition) => ({
        id: eventDefinition.id,
        legacyEventType: eventDefinition.legacyEventType,
        name: eventDefinition.name,
        description: eventDefinition.description,
        matchPhase: eventDefinition.matchPhase,
        category: eventDefinition.category,
        agePhases: eventDefinition.agePhases,
        fourCorner: eventDefinition.fourCorner,
        positionRelevance: eventDefinition.positionRelevance,
        enabledByDefault: eventDefinition.enabledByDefault,
        benchmarkable: eventDefinition.benchmarkable,
        isActive: eventDefinition.isActive,
        archivedAt: eventDefinition.archivedAt?.toISOString() ?? null,
      }))}
      matchPhaseOptions={matchPhaseOptions}
      categoryOptions={categoryOptions}
      agePhaseOptions={agePhaseOptions}
      fourCornerOptions={fourCornerOptions}
      positionOptions={positionOptions}
      createEventDefinitionAction={createEventDefinition}
      updateEventDefinitionAction={updateEventDefinition}
      archiveEventDefinitionAction={archiveEventDefinition}
      archiveEventDefinitionsAction={archiveEventDefinitions}
      restoreEventDefinitionAction={restoreEventDefinition}
    />
  )
}
