import { validateClassicObservationSelectionCounts, validateCustomObservationForNewMatchSelection } from '@/lib/clubTrackingDefinitions'
import { MAX_CLASSIC_OBSERVATIONS } from '@/lib/matchDayClassicSetup'

type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

export const customObservationsUnavailableReason = 'Custom observations are not available for this match.'

export function validateNoCustomFlagBypass(enabled: boolean, submittedClubTrackingDefinitionIds: readonly string[]): Result<true> {
  if (!enabled && submittedClubTrackingDefinitionIds.some((id) => id.trim())) {
    return { ok: false, reason: customObservationsUnavailableReason }
  }
  return { ok: true, value: true }
}

export function getClassicClubReportVisibility({ trackingV2Enabled, hasClubTrackingData }: { trackingV2Enabled: boolean; hasClubTrackingData: boolean }) {
  return trackingV2Enabled || hasClubTrackingData
}

export function getClassicDuplicateWarning(omittedCustomCount: number, customObservationsEnabled: boolean) {
  if (omittedCustomCount <= 0) return null
  if (!customObservationsEnabled) {
    return `${omittedCustomCount} custom observation${omittedCustomCount === 1 ? ' was' : 's were'} not copied because custom observations are not available right now.`
  }
  return `${omittedCustomCount} custom observation${omittedCustomCount === 1 ? ' was' : 's were'} not copied because ${omittedCustomCount === 1 ? 'it is' : 'they are'} no longer available for new Match Days.`
}

export function validateClassicDuplicateObservationCounts(input: { standardCount: number; legacyCount: number; customCount: number }): Result<true> {
  const eventDefinitionIds = [
    ...Array.from({ length: input.standardCount }, (_, index) => `event-${index}`),
    ...Array.from({ length: input.legacyCount }, (_, index) => `legacy-${index}`),
  ]
  const clubTrackingDefinitionIds = Array.from({ length: input.customCount }, (_, index) => `custom-${index}`)
  return validateClassicObservationSelectionCounts({ eventDefinitionIds, clubTrackingDefinitionIds })
}

export function validateClassicDuplicateTotalWithinLimit({ standardCount, legacyCount, customCount }: { standardCount: number; legacyCount: number; customCount: number }): Result<true> {
  const total = standardCount + legacyCount + customCount
  if (total > MAX_CLASSIC_OBSERVATIONS) {
    return { ok: false, reason: `This setup has ${total} observations. Review the setup before copying because a Match Day can include no more than ${MAX_CLASSIC_OBSERVATIONS}.` }
  }
  return validateClassicDuplicateObservationCounts({ standardCount, legacyCount, customCount })
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
