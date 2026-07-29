import type { MatchEventType } from '@prisma/client'

import { getEventDisplayName } from '@/lib/eventDefinitions'
import { isMatchEventType } from '@/lib/matchEventTaxonomy'

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
  matchDayId: string
  playerId: string
  eventType: MatchEventType | null
  eventDefinitionId: string | null
  eventDefinition?: { legacyEventType: MatchEventType | null } | null
  half: 'FIRST_HALF' | 'SECOND_HALF'
  matchSecond: number
  ownScoreAtTime: number
  oppositionScoreAtTime: number
  x?: number | null
  y?: number | null
}

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
    matchDayId: submission.matchDayId,
    playerId: submission.playerId,
    eventDefinitionId: submission.eventDefinitionId,
    eventType: submission.eventDefinition?.legacyEventType ?? submission.eventType,
    half: submission.half,
    matchSecond: submission.matchSecond,
    ownScoreAtTime: submission.ownScoreAtTime,
    oppositionScoreAtTime: submission.oppositionScoreAtTime,
    x: submission.x ?? null,
    y: submission.y ?? null,
  }
}
