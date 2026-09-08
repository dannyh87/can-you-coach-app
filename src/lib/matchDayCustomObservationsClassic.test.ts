import { describe, expect, it, vi } from 'vitest'

import {
  customObservationsUnavailableReason,
  filterCopyableClassicCustomObservationIds,
  getClassicClubReportVisibility,
  getClassicDuplicateWarning,
  validateClassicDuplicateTotalWithinLimit,
  validateNoCustomFlagBypass,
} from '@/lib/matchDayCustomObservationsClassic'

vi.mock('@/lib/clubTrackingDefinitions', () => ({
  validateClassicObservationSelectionCounts: vi.fn(({ eventDefinitionIds, clubTrackingDefinitionIds }) => {
    if (eventDefinitionIds.length + clubTrackingDefinitionIds.length > 8) return { ok: false, reason: 'Too many observations.' }
    if (clubTrackingDefinitionIds.length > 2) return { ok: false, reason: 'Too many custom observations.' }
    return { ok: true, value: true }
  }),
  validateCustomObservationForNewMatchSelection: vi.fn(async ({ clubTrackingDefinitionId }: { clubTrackingDefinitionId: string }) => (
    clubTrackingDefinitionId.startsWith('valid-') ? { ok: true, value: true } : { ok: false, reason: 'Unavailable.' }
  )),
}))

describe('classic Match Day custom observation hardening', () => {
  it('explicitly rejects custom identity submission when the feature is off', () => {
    expect(validateNoCustomFlagBypass(false, ['custom-1'])).toEqual({ ok: false, reason: customObservationsUnavailableReason })
    expect(validateNoCustomFlagBypass(false, [''])).toMatchObject({ ok: true })
    expect(validateNoCustomFlagBypass(false, ['event-1', 'custom-1'])).toEqual({ ok: false, reason: customObservationsUnavailableReason })
    expect(validateNoCustomFlagBypass(true, ['custom-1'])).toMatchObject({ ok: true })
  })

  it('fails duplication instead of truncating when current limits are exceeded', () => {
    expect(validateClassicDuplicateTotalWithinLimit({ standardCount: 6, legacyCount: 0, customCount: 2 })).toMatchObject({ ok: true })
    expect(validateClassicDuplicateTotalWithinLimit({ standardCount: 7, legacyCount: 0, customCount: 2 })).toMatchObject({ ok: false })
    expect(validateClassicDuplicateTotalWithinLimit({ standardCount: 1, legacyCount: 0, customCount: 3 })).toMatchObject({ ok: false })
  })

  it('uses clear custom omission warnings for duplicated setups', () => {
    expect(getClassicDuplicateWarning(0, true)).toBeNull()
    expect(getClassicDuplicateWarning(1, true)).toBe('1 custom observation was not copied because it is no longer available for new Match Days.')
    expect(getClassicDuplicateWarning(2, true)).toBe('2 custom observations were not copied because they are no longer available for new Match Days.')
    expect(getClassicDuplicateWarning(1, false)).toBe('1 custom observation was not copied because custom observations are not available right now.')
  })

  it('shows historical club reports when club/custom data exists independent of V2', () => {
    expect(getClassicClubReportVisibility({ trackingV2Enabled: false, hasClubTrackingData: false })).toBe(false)
    expect(getClassicClubReportVisibility({ trackingV2Enabled: false, hasClubTrackingData: true })).toBe(true)
    expect(getClassicClubReportVisibility({ trackingV2Enabled: true, hasClubTrackingData: false })).toBe(true)
  })

  it('filters copied custom observations by current availability and feature state', async () => {
    await expect(filterCopyableClassicCustomObservationIds({ enabled: false, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionIds: ['valid-1', 'retired-1'] })).resolves.toEqual({ ok: true, value: { copyableIds: [], omittedCount: 2 } })
    await expect(filterCopyableClassicCustomObservationIds({ enabled: true, userId: 'coach-1', teamId: 'team-1', clubTrackingDefinitionIds: ['valid-1', 'retired-1'] })).resolves.toEqual({ ok: true, value: { copyableIds: ['valid-1'], omittedCount: 1 } })
  })
})
