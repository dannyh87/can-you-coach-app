import type { ClubTrackingDefinitionKind, ClubTrackingMappingStatus, MatchEventType, Prisma } from '@prisma/client'

import { getEventDisplayName } from '@/lib/eventDefinitions'
import { isMatchEventType } from '@/lib/matchEventTaxonomy'
import { canRunMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

const definitionPrefix = 'definition:'
const legacyPrefix = 'legacy:'

export type ParentSubmissionEventKey =
  | { kind: 'definition'; eventDefinitionId: string }
  | { kind: 'legacy'; eventType: MatchEventType }

export type SelectedParentSubmissionEvent = {
  id: string
  eventType: MatchEventType | null
  eventDefinitionId: string | null
  eventDefinition: {
    id: string
    name: string
    description?: string | null
    legacyEventType: MatchEventType | null
    requiresLocation: boolean
  } | null
}

export type ResolvedParentSubmissionEvent = {
  selectedEvent: SelectedParentSubmissionEvent
  eventKey: string
  eventType: MatchEventType | null
  eventDefinitionId: string | null
  label: string
  description: string | null
  requiresLocation: boolean
}

export type ParentSubmissionDisplayEvent = {
  eventType?: MatchEventType | null
  eventDefinition?: { name: string } | null
}

export type AcceptedParentSubmissionSource = {
  id?: string
  matchDayId: string
  playerId: string | null
  eventType: MatchEventType | null
  eventDefinitionId: string | null
  eventDefinition?: { legacyEventType: MatchEventType | null } | null
  clubTrackingDefinitionId?: string | null
  standardEventDefinitionIdAtRecording?: string | null
  clubMappingRevisionAtRecording?: number | null
  clubMappingStatusAtRecording?: ClubTrackingMappingStatus | null
  half: 'FIRST_HALF' | 'SECOND_HALF'
  matchSecond: number
  ownScoreAtTime: number
  oppositionScoreAtTime: number
  x?: number | null
  y?: number | null
}

type AcceptSubmissionResult =
  | { ok: true; officialObservationId: string; alreadyAccepted: boolean }
  | { ok: false; reason: 'notAuthorized' | 'submissionMissing' | 'submissionNotPending' | 'invalidIdentity' | 'officialConflict' | 'staleReview'; message: string }

const acceptanceMessages: Record<Exclude<AcceptSubmissionResult, { ok: true }>['reason'], string> = {
  notAuthorized: 'You cannot review submissions for this match.',
  submissionMissing: 'Submission was not found.',
  submissionNotPending: 'This submission has already been reviewed.',
  invalidIdentity: 'This submission does not have a valid recorded identity.',
  officialConflict: 'This submission was already accepted by another review action.',
  staleReview: 'This review action is stale. Refresh and try again.',
}

const acceptError = (reason: Exclude<AcceptSubmissionResult, { ok: true }>['reason']): AcceptSubmissionResult => ({ ok: false, reason, message: acceptanceMessages[reason] })

export function createDefinitionEventKey(eventDefinitionId: string) {
  return `${definitionPrefix}${eventDefinitionId}`
}

export function createLegacyEventKey(eventType: MatchEventType) {
  return `${legacyPrefix}${eventType}`
}

export function parseParentSubmissionEventKey(value: string): ParentSubmissionEventKey | null {
  const trimmedValue = value.trim()
  if (trimmedValue.startsWith(definitionPrefix)) {
    const eventDefinitionId = trimmedValue.slice(definitionPrefix.length).trim()
    if (!eventDefinitionId) return null
    if (eventDefinitionId.includes(':')) return null
    return { kind: 'definition', eventDefinitionId }
  }

  if (trimmedValue.startsWith(legacyPrefix)) {
    const eventType = trimmedValue.slice(legacyPrefix.length).trim()
    if (!isMatchEventType(eventType)) return null
    return { kind: 'legacy', eventType }
  }

  return null
}

export function getSelectedEventCanonicalKey(event: SelectedParentSubmissionEvent) {
  if (event.eventDefinitionId) return createDefinitionEventKey(event.eventDefinitionId)
  if (event.eventDefinition?.id) return createDefinitionEventKey(event.eventDefinition.id)
  if (event.eventType) return createLegacyEventKey(event.eventType)
  return null
}

export function getSelectedEventLegacyType(event: SelectedParentSubmissionEvent) {
  return event.eventDefinition?.legacyEventType ?? event.eventType ?? null
}

export function getParentSubmissionEventDisplayName(event: ParentSubmissionDisplayEvent) {
  return getEventDisplayName(event)
}

export function getReviewIdentityLabel(input: { clubTrackingDefinitionId?: string | null; clubDefinitionKind?: ClubTrackingDefinitionKind | null; mappingStatusAtRecording?: ClubTrackingMappingStatus | null }) {
  if (!input.clubTrackingDefinitionId) return 'Standard'
  if (input.clubDefinitionKind === 'EVENT_ALIAS' || input.clubDefinitionKind === 'PATTERN_ALIAS') return 'Club alias'
  if (input.clubDefinitionKind === 'EVENT_CUSTOM') return 'Club specific'
  return input.mappingStatusAtRecording === 'STANDARD_APPROVED' ? 'Club mapped - standard approved' : 'Club mapped - club only'
}

export function getClubDefinitionSnapshotWarnings(input: {
  recordedMappingStatus?: ClubTrackingMappingStatus | null
  recordedMappingRevision?: number | null
  recordedStandardEventDefinitionId?: string | null
  recordedStandardPatternDefinitionId?: string | null
  currentDefinition?: { status: string; active: boolean; retiredAt: Date | null; mappingStatus: ClubTrackingMappingStatus; mappingRevision: number; mappedEventDefinitionId?: string | null; mappedPatternDefinitionId?: string | null; mappedEventDefinition?: { isActive?: boolean } | null; mappedPatternDefinition?: { active?: boolean } | null } | null
}) {
  const definition = input.currentDefinition
  if (!definition) return []
  const warnings: string[] = []
  if (definition.retiredAt || definition.status === 'RETIRED' || !definition.active) warnings.push('This definition has since been retired.')
  if (input.recordedMappingStatus && input.recordedMappingStatus !== definition.mappingStatus) warnings.push('The mapping status changed after this observation was recorded.')
  if (input.recordedMappingRevision && input.recordedMappingRevision !== definition.mappingRevision) warnings.push(`Recorded under mapping revision ${input.recordedMappingRevision}; the current revision is ${definition.mappingRevision}.`)
  if (input.recordedStandardEventDefinitionId && input.recordedStandardEventDefinitionId !== definition.mappedEventDefinitionId) warnings.push('The mapped standard identity changed after recording.')
  if (input.recordedStandardPatternDefinitionId && input.recordedStandardPatternDefinitionId !== definition.mappedPatternDefinitionId) warnings.push('The mapped standard identity changed after recording.')
  if (definition.mappedEventDefinition && definition.mappedEventDefinition.isActive === false) warnings.push('The mapped standard definition is no longer active.')
  if (definition.mappedPatternDefinition && definition.mappedPatternDefinition.active === false) warnings.push('The mapped standard definition is no longer active.')
  return Array.from(new Set(warnings))
}

export function resolveSelectedParentSubmissionEvent({
  eventKey,
  selectedEvents,
}: {
  eventKey: string
  selectedEvents: SelectedParentSubmissionEvent[]
}): ResolvedParentSubmissionEvent | null {
  const parsedKey = parseParentSubmissionEventKey(eventKey)
  if (!parsedKey) return null

  const selectedEvent = selectedEvents.find((event) => {
    if (parsedKey.kind === 'definition') {
      return event.eventDefinitionId === parsedKey.eventDefinitionId || event.eventDefinition?.id === parsedKey.eventDefinitionId
    }

    return event.eventType === parsedKey.eventType || event.eventDefinition?.legacyEventType === parsedKey.eventType
  })
  if (!selectedEvent) return null

  const canonicalKey = getSelectedEventCanonicalKey(selectedEvent)
  if (!canonicalKey) return null

  const eventDefinitionId = selectedEvent.eventDefinitionId ?? selectedEvent.eventDefinition?.id ?? null
  const eventType = getSelectedEventLegacyType(selectedEvent)

  return {
    selectedEvent,
    eventKey: canonicalKey,
    eventType,
    eventDefinitionId,
    label: getParentSubmissionEventDisplayName(selectedEvent),
    description: selectedEvent.eventDefinition?.description ?? null,
    requiresLocation: selectedEvent.eventDefinition?.requiresLocation ?? false,
  }
}

export function getParentSubmissionEventOptions(selectedEvents: SelectedParentSubmissionEvent[]) {
  const optionsByKey = new Map<string, ResolvedParentSubmissionEvent>()

  for (const selectedEvent of selectedEvents) {
    const canonicalKey = getSelectedEventCanonicalKey(selectedEvent)
    if (!canonicalKey || optionsByKey.has(canonicalKey)) continue

    const resolvedEvent = resolveSelectedParentSubmissionEvent({
      eventKey: canonicalKey,
      selectedEvents: [selectedEvent],
    })
    if (resolvedEvent) optionsByKey.set(canonicalKey, resolvedEvent)
  }

  return Array.from(optionsByKey.values())
}

export function submissionsHaveSameEventIdentity(
  first: { eventType: MatchEventType | null; eventDefinitionId: string | null },
  second: { eventType: MatchEventType | null; eventDefinitionId: string | null }
) {
  if (first.eventDefinitionId || second.eventDefinitionId) {
    return Boolean(first.eventDefinitionId && first.eventDefinitionId === second.eventDefinitionId)
  }

  return Boolean(first.eventType && first.eventType === second.eventType)
}

export function buildAcceptedSubmissionMatchEventData(submission: AcceptedParentSubmissionSource) {
  return {
    submittedMatchEventId: submission.id,
    matchDayId: submission.matchDayId,
    playerId: submission.playerId,
    eventDefinitionId: submission.eventDefinitionId,
    eventType: submission.clubTrackingDefinitionId ? submission.eventType : submission.eventDefinition?.legacyEventType ?? submission.eventType,
    clubTrackingDefinitionId: submission.clubTrackingDefinitionId ?? null,
    standardEventDefinitionIdAtRecording: submission.standardEventDefinitionIdAtRecording ?? null,
    clubMappingRevisionAtRecording: submission.clubMappingRevisionAtRecording ?? null,
    clubMappingStatusAtRecording: submission.clubMappingStatusAtRecording ?? null,
    half: submission.half,
    matchSecond: submission.matchSecond,
    ownScoreAtTime: submission.ownScoreAtTime,
    oppositionScoreAtTime: submission.oppositionScoreAtTime,
    x: submission.x ?? null,
    y: submission.y ?? null,
  }
}

function hasValidSubmittedEventIdentity(submission: { eventDefinitionId: string | null; eventType: MatchEventType | null; clubTrackingDefinitionId?: string | null }) {
  return Boolean(submission.eventDefinitionId || submission.eventType || submission.clubTrackingDefinitionId)
}

function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as Prisma.PrismaClientKnownRequestError).code === 'P2002'
}

export async function acceptSubmittedMatchEvent({ db = prisma, actorUserId, matchDayId, submittedMatchEventId }: { db?: typeof prisma; actorUserId: string; matchDayId: string; submittedMatchEventId: string }): Promise<AcceptSubmissionResult> {
  if (!(await canRunMatchDay(actorUserId, matchDayId))) return acceptError('notAuthorized')
  return db.$transaction(async (tx) => {
    const existing = await tx.matchEvent.findUnique({ where: { submittedMatchEventId }, select: { id: true } })
    if (existing) return { ok: true as const, officialObservationId: existing.id, alreadyAccepted: true }
    const submission = await tx.submittedMatchEvent.findFirst({
      where: { id: submittedMatchEventId, matchDayId },
      include: { eventDefinition: true, clubTrackingDefinition: true, assignment: { select: { trackingTask: { select: { scopeType: true } } } }, matchDay: { select: { status: true } } },
    })
    if (!submission) return acceptError('submissionMissing')
    if (submission.submittedByUserId === actorUserId && submission.assignmentId) return { ok: false as const, reason: 'notAuthorized', message: 'Contributors cannot review their own observations.' }
    if (submission.status !== 'PENDING') {
      const reviewedOfficial = await tx.matchEvent.findUnique({ where: { submittedMatchEventId }, select: { id: true } })
      return reviewedOfficial ? { ok: true as const, officialObservationId: reviewedOfficial.id, alreadyAccepted: true } : acceptError('submissionNotPending')
    }
    if (submission.matchDay.status === 'DRAFT') return acceptError('staleReview')
    if (!hasValidSubmittedEventIdentity(submission)) return acceptError('invalidIdentity')
    const canBePlayerlessAssignment = submission.assignment?.trackingTask.scopeType === 'UNIT' || submission.assignment?.trackingTask.scopeType === 'TEAM'
    if (submission.playerId) {
      const matchPlayer = await tx.matchDayPlayer.findFirst({ where: { matchDayId, playerId: submission.playerId, squadStatus: { not: 'NOT_INVOLVED' } }, select: { id: true } })
      if (!matchPlayer) return acceptError('invalidIdentity')
    } else if (!canBePlayerlessAssignment) return acceptError('invalidIdentity')
    if (!submission.clubTrackingDefinitionId) {
      const selectedEventType = await tx.matchDayEventType.findFirst({ where: submission.eventDefinitionId ? { matchDayId, OR: [{ eventDefinitionId: submission.eventDefinitionId }, ...(submission.eventType ? [{ eventType: submission.eventType }] : [])] } : { matchDayId, eventType: submission.eventType }, select: { id: true } })
      if (!selectedEventType) return acceptError('invalidIdentity')
    }
    const reviewedAt = new Date()
    const updated = await tx.submittedMatchEvent.updateMany({ where: { id: submission.id, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt: reviewedAt, acceptedByUserId: actorUserId } })
    if (updated.count !== 1) return acceptError('submissionNotPending')
    try {
      const official = await tx.matchEvent.create({ data: buildAcceptedSubmissionMatchEventData(submission), select: { id: true } })
      return { ok: true as const, officialObservationId: official.id, alreadyAccepted: false }
    } catch (error) {
      if (isUniqueConflict(error)) {
        const official = await tx.matchEvent.findUnique({ where: { submittedMatchEventId }, select: { id: true } })
        if (official) return { ok: true as const, officialObservationId: official.id, alreadyAccepted: true }
      }
      return acceptError('officialConflict')
    }
  })
}
