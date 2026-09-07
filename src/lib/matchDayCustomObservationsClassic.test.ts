import { describe, expect, it } from 'vitest'

import {
  customObservationsUnavailableReason,
  getClassicClubReportVisibility,
  getClassicDuplicateWarning,
  validateClassicDuplicateTotalWithinLimit,
  validateNoCustomFlagBypass,
} from '@/lib/matchDayCustomObservationsClassic'

describe('classic Match Day custom observation hardening', () => {
  it('explicitly rejects custom identity submission when the feature is off', () => {
    expect(validateNoCustomFlagBypass(false, 'custom-1')).toEqual({ ok: false, reason: customObservationsUnavailableReason })
    expect(validateNoCustomFlagBypass(false, '')).toMatchObject({ ok: true })
    expect(validateNoCustomFlagBypass(true, 'custom-1')).toMatchObject({ ok: true })
  })

  it('fails duplication instead of truncating when current limits are exceeded', () => {
    expect(validateClassicDuplicateTotalWithinLimit({ standardCount: 6, legacyCount: 0, customCount: 2 })).toMatchObject({ ok: true })
    expect(validateClassicDuplicateTotalWithinLimit({ standardCount: 7, legacyCount: 0, customCount: 2 })).toMatchObject({ ok: false })
    expect(validateClassicDuplicateTotalWithinLimit({ standardCount: 1, legacyCount: 0, customCount: 3 })).toMatchObject({ ok: false })
  })

  it('uses a generic custom omission warning for duplicated setups', () => {
    expect(getClassicDuplicateWarning(0)).toBeNull()
    expect(getClassicDuplicateWarning(1)).toBe('1 custom observation was not copied because it is no longer available for new Match Days.')
    expect(getClassicDuplicateWarning(2)).toBe('2 custom observations were not copied because they are no longer available for new Match Days.')
  })

  it('shows historical club reports when club/custom data exists independent of V2', () => {
    expect(getClassicClubReportVisibility({ trackingV2Enabled: false, hasClubTrackingData: false })).toBe(false)
    expect(getClassicClubReportVisibility({ trackingV2Enabled: false, hasClubTrackingData: true })).toBe(true)
    expect(getClassicClubReportVisibility({ trackingV2Enabled: true, hasClubTrackingData: false })).toBe(true)
  })
})
