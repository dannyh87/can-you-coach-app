import type { ClubTrackingDefinitionStatus, ClubTrackingDefinitionVisibilityScope } from '@prisma/client'

import { validateClassicObservationSelectionCounts, validateCustomObservationForNewMatchSelection } from '@/lib/clubTrackingDefinitions'
import { MAX_CLASSIC_OBSERVATIONS } from '@/lib/matchDayClassicSetup'

type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

export const customObservationsUnavailableReason = 'Custom observations are not available for this match.'

export type ClassicCustomDefinitionForCopy = {
  id: string
  status: ClubTrackingDefinitionStatus
  active: boolean
  retiredAt: Date | null
  clubId: string
  teamId: string | null
  visibilityScope: ClubTrackingDefinitionVisibilityScope
  kind: string
  mappedEventDefinitionId: string | null
  mappedPatternDefinitionId: string | null
  mappingStatus: string | null
}

export function shouldExposeClassicCustomControls(enabled: boolean) {
  return enabled
}

export function shouldExposeClassicCustomRecordingButton(enabled: boolean) {
  return enabled
}

export function validateNoCustomFlagBypass(enabled: boolean, submittedClubTrackingDefinitionId: string | null | undefined): Result<true> {
  if (!enabled && submittedClubTrackingDefinitionId?.trim()) return { ok: false, reason: customObservationsUnavailableReason }
  return { ok: true, value: true }
}

export function getClassicClubReportVisibility({ trackingV2Enabled, hasClubTrackingData }: { trackingV2Enabled: boolean; hasClubTrackingData: boolean }) {
  return trackingV2Enabled || hasClubTrackingData
}

export function validateClassicDuplicateObservationCounts(input: { standardCount: number; legacyCount: number; customCount: number }): Result<true> {
  const eventDefinitionIds = Array.from({ length: input.standardCount }, (_, index) => `event-${index}`)
  const legacyIds = Array.from({ length: input.legacyCount }, (_, index) => `legacy-${index}`)
  const clubTrackingDefinitionIds = Array.from({ length: input.customCount }, (_, index) => `custom-${index}`)
  return validateClassicObservationSelectionCounts({ eventDefinitionIds: [...eventDefinitionIds, ...legacyIds], clubTrackingDefinitionIds })
}

export function getClassicDuplicateWarning(omittedCustomCount: number) {
  if (omittedCustomCount <= 0) return null
  return `${omittedCustomCount} custom observation${omittedCustomCount === 1 ? ' was' : 's were'} not copied because ${omittedCustomCount === 1 ? 'it is' : 'they are'} no longer available for new Match Days.`
}

export async function filterCopyableClassicCustomObservationIds({
  enabled,
  userId,
  teamId,
  clubTrackingDefinitionIds,
}: {
  enabled: boolean
  userId: string
  teamId: string
  clubTrackingDefinitionIds: string[]
}): Promise<Result<{ copyableIds: string[]; omittedCount: number }>> {
  if (!enabled) return { ok: true, value: { copyableIds: [], omittedCount: clubTrackingDefinitionIds.length } }
  const copyableIds: string[] = []
  let omittedCount = 0
  for (const clubTrackingDefinitionId of clubTrackingDefinitionIds) {
    const validation = await validateCustomObservationForNewMatchSelection({ userId, teamId, clubTrackingDefinitionId })
    if (validation.ok) copyableIds.push(clubTrackingDefinitionId)
    else omittedCount += 1
  }
  const countValidation = validateClassicDuplicateObservationCounts({ standardCount: 0, legacyCount: 0, customCount: copyableIds.length })
  if (!countValidation.ok) return countValidation
  return { ok: true, value: { copyableIds, omittedCount } }
}

export function validateClassicDuplicateTotalWithinLimit({ standardCount, legacyCount, customCount }: { standardCount: number; legacyCount: number; customCount: number }): Result<true> {
  const total = standardCount + legacyCount + customCount
  if (total > MAX_CLASSIC_OBSERVATIONS) return { ok: false, reason: `This setup has ${total} observations. Review the setup before copying because a Match Day can include no more than ${MAX_CLASSIC_OBSERVATIONS}.` }
  return validateClassicDuplicateObservationCounts({ standardCount, legacyCount, customCount })
}
