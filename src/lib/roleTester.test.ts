import { describe, expect, it } from 'vitest'

import { normalizeRoleTesterEmailCookie } from '@/lib/roleTester'

describe('normalizeRoleTesterEmailCookie', () => {
  it('decodes role tester emails stored in cookies', () => {
    expect(normalizeRoleTesterEmailCookie('parent%40test.can-you-coach.local')).toBe('parent@test.can-you-coach.local')
  })

  it('normalizes whitespace and case', () => {
    expect(normalizeRoleTesterEmailCookie(' Coach%40Test.Can-You-Coach.Local ')).toBe('coach@test.can-you-coach.local')
  })

  it('returns null for missing cookies', () => {
    expect(normalizeRoleTesterEmailCookie(undefined)).toBeNull()
  })
})
