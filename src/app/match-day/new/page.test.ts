import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  customObservationsEnabled: true,
  teams: [] as ReturnType<typeof buildTeam>[],
  getActiveSelectableCustomObservationsForTeam: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('a', null, children),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/app/match-day/new/MatchDayWizard', () => ({
  default: () => React.createElement('div', null, 'wizard'),
}))

vi.mock('@/components/ui/PageHeader', () => ({
  default: () => React.createElement('header'),
}))

vi.mock('@/lib/accessWhere', () => ({
  accessibleTeamWhere: vi.fn(async () => ({})),
  getManageableTeamIds: vi.fn(async () => mocks.teams.map((team) => team.id)),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
}))

vi.mock('@/lib/clubTrackingDefinitions', () => ({
  createTeamCustomObservationForMatchSetup: vi.fn(),
  findCustomObservationCreationConflicts: vi.fn(),
  getActiveSelectableCustomObservationsForTeam: mocks.getActiveSelectableCustomObservationsForTeam,
  MAX_CLASSIC_CUSTOM_OBSERVATIONS: 2,
  validateClassicObservationSelectionCounts: vi.fn(),
  validateCustomObservationForNewMatchSelection: vi.fn(),
  validateMatchDayEventTypeIdentityShape: vi.fn(() => ({ ok: true })),
}))

vi.mock('@/lib/features', () => ({
  isMatchDayCustomObservationsEnabled: vi.fn(() => mocks.customObservationsEnabled),
}))

vi.mock('@/lib/matchDayClassicSetup', () => ({
  buildClassicMatchDayPlayerCreates: vi.fn(),
  MAX_CLASSIC_OBSERVATIONS: 8,
}))

vi.mock('@/lib/eventDefinitions', () => ({
  getActiveRecordableEventDefinitions: vi.fn(async () => [eventDefinition()]),
  getMatchDayEventCategoryFallback: vi.fn(() => 'IN_POSSESSION'),
  getRecordableEventPhaseGroups: vi.fn(() => [{ value: 'IN_POSSESSION', label: 'In possession', events: [eventDefinition()] }]),
}))

vi.mock('@/lib/matchEventTaxonomy', () => ({
  inferAgePhase: vi.fn(() => 'YOUTH'),
}))

vi.mock('@/lib/permissions', () => ({
  canManageTeamData: vi.fn(async () => true),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: vi.fn(async () => mocks.teams) },
    matchDay: { findMany: vi.fn(async () => []), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    player: { findMany: vi.fn() },
    eventDefinition: { findMany: vi.fn() },
    clubTrackingDefinition: { findMany: vi.fn() },
  },
}))

describe('NewMatchDayPage', () => {
  beforeEach(() => {
    mocks.customObservationsEnabled = true
    mocks.teams = [buildTeam('team-1', 'Under 12s'), buildTeam('team-2', 'Under 13s'), buildTeam('team-3', 'Under 14s')]
    mocks.getActiveSelectableCustomObservationsForTeam.mockReset()
  })

  it('renders authenticated page props when one custom preload fails', async () => {
    mocks.getActiveSelectableCustomObservationsForTeam.mockImplementation(async ({ teamId }: { teamId: string }) => {
      if (teamId === 'team-1') return { ok: true as const, value: [customObservation()] }
      if (teamId === 'team-2') throw new Error('database timeout: select * from ClubTrackingDefinition at secret-host')
      return { ok: true as const, value: [] }
    })
    const { default: NewMatchDayPage } = await import('@/app/match-day/new/page')

    const element = await NewMatchDayPage()
    const props = findWizardProps(element)

    expect(React.isValidElement(element)).toBe(true)
    expect(props).toBeTruthy()
    expect(props).not.toHaveProperty('loadCustomObservationsForTeamAction')
    expect(props?.customObservationsByTeamId).toEqual({
      'team-1': { state: 'loaded', observations: [plainCustomObservation()], error: null },
      'team-2': { state: 'error', observations: [], error: 'Could not load custom observations for this team.' },
      'team-3': { state: 'loaded', observations: [], error: null },
    })
    expect(JSON.stringify(props?.customObservationsByTeamId)).not.toContain('database timeout')
    expect(JSON.stringify(props?.customObservationsByTeamId)).not.toContain('secret-host')
    expectAllPlainSerializableValues(props?.customObservationsByTeamId)
  })

  it('uses generic client text for unsuccessful preload results', async () => {
    mocks.getActiveSelectableCustomObservationsForTeam.mockResolvedValue({ ok: false as const, reason: 'PrismaClientKnownRequestError: sensitive database detail' })
    const { default: NewMatchDayPage } = await import('@/app/match-day/new/page')

    const props = findWizardProps(await NewMatchDayPage())

    expect(props?.customObservationsByTeamId).toEqual({
      'team-1': { state: 'error', observations: [], error: 'Could not load custom observations for this team.' },
      'team-2': { state: 'error', observations: [], error: 'Could not load custom observations for this team.' },
      'team-3': { state: 'error', observations: [], error: 'Could not load custom observations for this team.' },
    })
    expect(JSON.stringify(props?.customObservationsByTeamId)).not.toContain('PrismaClientKnownRequestError')
    expect(JSON.stringify(props?.customObservationsByTeamId)).not.toContain('sensitive database detail')
  })

  it('skips custom observation queries in feature-off mode', async () => {
    mocks.customObservationsEnabled = false
    const { default: NewMatchDayPage } = await import('@/app/match-day/new/page')

    const props = findWizardProps(await NewMatchDayPage())

    expect(mocks.getActiveSelectableCustomObservationsForTeam).not.toHaveBeenCalled()
    expect(props?.customObservationsEnabled).toBe(false)
    expect(props?.customObservationsByTeamId).toEqual({})
    expect(props).not.toHaveProperty('loadCustomObservationsForTeamAction')
  })
})

function findWizardProps(node: React.ReactNode): Record<string, unknown> | null {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return null
  if ('customObservationsByTeamId' in node.props) return node.props as Record<string, unknown>

  const children = React.Children.toArray(node.props.children)
  for (const child of children) {
    const result = findWizardProps(child)
    if (result) return result
  }

  return null
}

function expectAllPlainSerializableValues(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value)
  assertNoDateOrFunction(value)
}

function assertNoDateOrFunction(value: unknown) {
  expect(value instanceof Date).toBe(false)
  expect(typeof value).not.toBe('function')
  if (Array.isArray(value)) {
    value.forEach(assertNoDateOrFunction)
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(assertNoDateOrFunction)
  }
}

function buildTeam(id: string, name: string) {
  return { id, clubId: 'club-1', name, ageGroup: 'U12', club: { name: 'Test FC' }, players: [] }
}

function eventDefinition() {
  return {
    id: 'event-pass',
    scope: 'GLOBAL',
    clubId: null,
    label: 'Pass complete',
    slug: 'pass-complete',
    normalizedName: 'pass complete',
    category: 'PASSING',
    categoryLabel: 'Passing',
    subcategory: null,
    description: null,
    videoUrl: null,
    matchPhase: 'IN_POSSESSION',
    matchPhaseLabel: 'In possession',
    agePhases: ['YOUTH'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: true,
  }
}

function customObservation() {
  return {
    ...plainCustomObservation(),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    internalSecret: 'do not pass to client',
  }
}

function plainCustomObservation() {
  return {
    id: 'custom-1',
    clubId: 'club-1',
    teamId: 'team-1',
    visibilityScope: 'TEAM',
    label: 'Lock the six',
    normalizedName: 'lock six',
    countingDefinition: 'Protect central space',
    guidance: null,
    category: 'DEFENDING',
    categoryLabel: 'Defending',
    polarity: 'POSITIVE',
    requiresLocation: false,
    sourceLabel: 'Custom · Your team',
  }
}
