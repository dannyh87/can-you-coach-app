// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MatchDayWizard from '@/app/match-day/new/MatchDayWizard'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
  }
  container?.remove()
  root = null
  container = null
})

describe('MatchDayWizard event selector', () => {
  it('keeps search focus while filtering and preserving selected events', async () => {
    renderWizard()

    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Choose events myself')
    await clickInput('Add Pass complete')

    expect(getInputByLabel('Remove Pass complete').checked).toBe(true)
    expect(document.body.textContent).toContain('Selected ✓')
    expect(document.body.textContent).not.toContain('RemoveLimit reachedAdd')

    const searchInput = getInputByLabel('Search events')
    await focusInput(searchInput)

    expect(document.activeElement).toBe(searchInput)

    for (const character of ['p', 'a', 's', 's']) {
      await typeIntoInput(searchInput, `${searchInput.value}${character}`)
      expect(document.activeElement).toBe(searchInput)
    }

    expect(searchInput.value).toBe('pass')
    expect(document.body.textContent).toContain('Pass complete')
    expect(document.body.textContent).not.toContain('Goal')
    expect(getInputByLabel('Remove Pass complete').checked).toBe(true)
    expect(document.body.textContent).toContain('1 event selected of 8')

    await typeIntoInput(searchInput, '')

    expect(searchInput.value).toBe('')
    expect(document.activeElement).toBe(searchInput)
    expect(document.body.textContent).toContain('Goal')
    expect(getInputByLabel('Remove Pass complete').checked).toBe(true)
  })

  it('exposes selected semantics for category filters', async () => {
    renderWizard()

    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Choose events myself')
    await clickButton('Passing')

    const passingCategory = getButtonByText('Passing')
    const allCategory = getButtonByText('All')

    expect(passingCategory.getAttribute('role')).toBe('radio')
    expect(passingCategory.getAttribute('aria-checked')).toBe('true')
    expect(passingCategory.textContent).toContain('selected ✓')
    expect(allCategory.getAttribute('aria-checked')).toBe('false')
    expect(document.body.textContent).toContain('Pass complete')
    expect(document.body.textContent).not.toContain('Goal')
  })

  it('exposes previous setup selection as a radio group', async () => {
    renderWizard({ previousSetups: previousSetups() })

    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Use my last setup')

    const firstSetup = getButtonByText('Test FC vs Old Rival')
    const secondSetup = getButtonByText('Test FC vs Older Rival')

    expect(firstSetup.closest('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Previous setups')
    expect(firstSetup.getAttribute('role')).toBe('radio')
    expect(firstSetup.getAttribute('aria-checked')).toBe('true')
    expect(firstSetup.textContent).toContain('Selected ✓')

    await clickButton('Older Rival')

    expect(firstSetup.getAttribute('aria-checked')).toBe('false')
    expect(secondSetup.getAttribute('aria-checked')).toBe('true')
    expect(secondSetup.textContent).toContain('Selected ✓')
  })

  it('prevents duplicate create submissions while pending and clears loading after failure', async () => {
    const pendingCreate = deferred<{ ok: false; reason: string } | void>()
    const createAction = vi.fn(() => pendingCreate.promise)

    renderWizard({ createAction })

    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Choose events myself')
    await clickInput('Add Pass complete')
    await clickButton('Done')
    await clickButton('Next')

    await clickButton('Create Match')

    const pendingButton = getButtonByText('Creating Match Day…')
    expect(pendingButton.getAttribute('aria-busy')).toBe('true')
    expect(pendingButton.hasAttribute('disabled')).toBe(true)

    await clickButton('Creating Match Day…')

    expect(createAction).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingCreate.resolve({ ok: false, reason: 'Could not create the match.' })
      await pendingCreate.promise
    })

    const createButton = getButtonByText('Create Match')
    expect(createButton.getAttribute('aria-busy')).toBe(null)
    expect(createButton.hasAttribute('disabled')).toBe(false)
    expect(document.body.textContent).toContain('Could not create the match.')
  })

  it('loads custom observations for the selected team only and ignores stale responses', async () => {
    const firstLoad = deferred<{ ok: true; value: Array<ReturnType<typeof customObservation>> }>()
    const secondLoad = deferred<{ ok: true; value: Array<ReturnType<typeof customObservation>> }>()
    const loadAction = vi.fn((formData: FormData) => formData.get('teamId') === 'team-1' ? firstLoad.promise : secondLoad.promise)

    renderWizard({ customObservationsEnabled: true, loadCustomObservationsForTeamAction: loadAction, teams: teamOptions() })
    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Under 13s')

    expect(loadAction).toHaveBeenLastCalledWith(expect.any(FormData))

    await act(async () => {
      secondLoad.resolve({ ok: true, value: [customObservation({ id: 'team-2-custom', teamId: 'team-2', label: 'Team two custom' })] })
      await secondLoad.promise
    })
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Choose events myself')

    expect(document.body.textContent).toContain('Team two custom')

    await act(async () => {
      firstLoad.resolve({ ok: true, value: [customObservation({ id: 'team-1-custom', teamId: 'team-1', label: 'Team one custom' })] })
      await firstLoad.promise
    })

    expect(document.body.textContent).toContain('Team two custom')
    expect(document.body.textContent).not.toContain('Team one custom')
    expect(loadAction).toHaveBeenCalledWith(expect.any(FormData))
  })

  it('keeps custom-only previous setup unavailable while custom observations are still loading', async () => {
    const load = deferred<{ ok: true; value: Array<ReturnType<typeof customObservation>> }>()
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: () => load.promise,
      previousSetups: [customOnlyPreviousSetup()],
    })

    await openPreviousSetupPicker()

    const applyButton = getButtonByText('Loading custom observations…')
    expect(applyButton.hasAttribute('disabled')).toBe(true)
    expect(document.body.textContent).toContain('Loading custom observations before this setup can be applied.')

    await clickButton('Loading custom observations…')
    expect(document.body.textContent).not.toContain('Select at least one event to track for this match.')
  })

  it('applies a loaded custom-only previous setup and passes event validation', async () => {
    const createAction = vi.fn(async () => undefined)
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: async () => ({ ok: true as const, value: [customObservation()] }),
      previousSetups: [customOnlyPreviousSetup()],
      createAction,
    })

    await openPreviousSetupPicker()
    await clickButton('Use this setup')
    await clickButton('Next')
    await clickButton('Create Match')

    expect(document.body.textContent).not.toContain('Select at least one event to track for this match.')
    expect(createAction).toHaveBeenCalledTimes(1)
    const formData = createAction.mock.calls[0][0] as FormData
    expect(formData.getAll('eventDefinitionId')).toEqual([])
    expect(formData.getAll('clubTrackingDefinitionId')).toEqual(['custom-1'])
  })

  it('preserves both standard and custom identities from a mixed previous setup', async () => {
    const createAction = vi.fn(async () => undefined)
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: async () => ({ ok: true as const, value: [customObservation()] }),
      previousSetups: [mixedPreviousSetup()],
      createAction,
    })

    await openPreviousSetupPicker()
    expect(document.body.textContent).toContain('2 events selected')
    expect(document.body.textContent).toContain('Pass complete')
    expect(document.body.textContent).toContain('Lock the six')

    await clickButton('Use this setup')
    await clickButton('Next')
    await clickButton('Create Match')

    const formData = createAction.mock.calls[0][0] as FormData
    expect(formData.getAll('eventDefinitionId')).toEqual(['event-pass-complete'])
    expect(formData.getAll('clubTrackingDefinitionId')).toEqual(['custom-1'])
  })

  it('uses custom definition labels in previous setup previews', async () => {
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: async () => ({ ok: true as const, value: [customObservation()] }),
      previousSetups: [customOnlyPreviousSetup()],
    })

    await openPreviousSetupPicker()

    expect(document.body.textContent).toContain('1 event selected')
    expect(document.body.textContent).toContain('Lock the six')
    expect(document.body.textContent).not.toContain('Legacy event')
  })

  it('omits inaccessible custom observations with a generic warning after loading', async () => {
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: async () => ({ ok: true as const, value: [customObservation()] }),
      previousSetups: [{
        ...customOnlyPreviousSetup(),
        selectedClubTrackingDefinitionIds: ['custom-1', 'retired-custom'],
        eventLabels: ['Lock the six', 'Retired secret custom'],
      }],
    })

    await openPreviousSetupPicker()
    await clickButton('Use this setup')

    expect(document.body.textContent).toContain('1 unavailable event were omitted.')
    expect(document.body.textContent).toContain('1 event selected of 8')
    expect(document.body.textContent).not.toContain('Retired secret custom')
  })

  it('prevents previous setup application after failed custom loading until retry succeeds', async () => {
    const loadAction = vi.fn(async () => loadAction.mock.calls.length === 1
      ? { ok: false as const, reason: 'No access' }
      : { ok: true as const, value: [customObservation()] })
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: loadAction,
      previousSetups: [customOnlyPreviousSetup()],
    })

    await openPreviousSetupPicker()

    const unavailableButton = getButtonByText('Custom observations unavailable')
    expect(unavailableButton.hasAttribute('disabled')).toBe(true)
    expect(document.body.textContent).toContain('No access')

    await clickButton('Retry custom observations')
    await clickButton('Use this setup')

    expect(document.body.textContent).toContain('1 event selected of 8')
  })

  it('keeps stale custom loads from enabling or populating the wrong previous setup', async () => {
    const firstLoad = deferred<{ ok: true; value: Array<ReturnType<typeof customObservation>> }>()
    const secondLoad = deferred<{ ok: true; value: Array<ReturnType<typeof customObservation>> }>()
    const loadAction = vi.fn((formData: FormData) => formData.get('teamId') === 'team-2' ? firstLoad.promise : secondLoad.promise)
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: loadAction,
      teams: teamOptions(),
      previousSetups: [customOnlyPreviousSetup(), customOnlyPreviousSetup({ id: 'setup-2', teamId: 'team-2', teamName: 'Test FC', selectedClubTrackingDefinitionIds: ['team-2-custom'], eventLabels: ['Team two custom'] })],
    })

    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Under 13s')
    await clickButton('Under 12s')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Use my last setup')

    await act(async () => {
      firstLoad.resolve({ ok: true, value: [customObservation({ id: 'team-2-custom', teamId: 'team-2', label: 'Team two custom' })] })
      await firstLoad.promise
    })

    expect(getButtonByText('Loading custom observations…').hasAttribute('disabled')).toBe(true)
    expect(document.body.textContent).not.toContain('Team two custom')

    await act(async () => {
      secondLoad.resolve({ ok: true, value: [customObservation()] })
      await secondLoad.promise
    })
    await clickButton('Use this setup')

    expect(document.body.textContent).toContain('Lock the six')
    expect(document.body.textContent).not.toContain('Team two custom')
  })

  it('treats a loaded empty custom result differently from a pending load', async () => {
    renderWizard({
      customObservationsEnabled: true,
      loadCustomObservationsForTeamAction: async () => ({ ok: true as const, value: [] }),
      previousSetups: [customOnlyPreviousSetup()],
    })

    await openPreviousSetupPicker()

    const applyButton = getButtonByText('Use this setup')
    expect(applyButton.hasAttribute('disabled')).toBe(false)

    await clickButton('Use this setup')

    expect(document.body.textContent).toContain('1 unavailable event were omitted.')
    expect(document.body.textContent).toContain('0 events selected of 8')
  })

  it('shows custom loading failure and retries without selecting results', async () => {
    const loadAction = vi.fn(async () => loadAction.mock.calls.length === 1 ? { ok: false as const, reason: 'No access' } : { ok: true as const, value: [customObservation({ id: 'custom-1', label: 'Lock the six' })] })
    renderWizard({ customObservationsEnabled: true, loadCustomObservationsForTeamAction: loadAction })
    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Choose events myself')

    expect(document.body.textContent).toContain('No access')
    await clickButton('Retry custom observations')

    expect(document.body.textContent).toContain('Lock the six')
    expect(document.body.textContent).toContain('0 events selected of 8')
  })

  it('handles quick-create duplicate, similar and create-anyway flows', async () => {
    const createAction = vi.fn(async (formData: FormData) => formData.get('createAnyway') === 'true'
      ? { ok: true as const, value: customObservation({ id: 'new-custom', label: String(formData.get('name')) }) }
      : { ok: false as const, reason: 'Review similar observations before creating a new one.', code: 'similarMatches', similar: [customObservation({ id: 'similar', label: 'Counter press won' })] })
    const checkConflictsAction = vi.fn(async () => ({ ok: true as const, value: { exact: null, similar: [customObservation({ id: 'similar', label: 'Counter press won' })] } }))
    renderWizard({ customObservationsEnabled: true, loadCustomObservationsForTeamAction: async () => ({ ok: true as const, value: [] }), createCustomObservationAction: createAction, checkCustomObservationConflictsAction: checkConflictsAction })
    await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Next')
    await clickButton('Choose events myself')
    await clickButton('Create a team observation')

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Create a team observation')
    await typeIntoInput(getInputByLabel('Name'), 'Counter press regain')
    await typeIntoTextarea('What should be counted?', 'Regain after pressure')
    await clickButton('Save and add to this match')
    expect(document.body.textContent).toContain('Counter press won')
    expect(getButtonByText('Save and add to this match').hasAttribute('disabled')).toBe(true)
    await clickInputByLabelText('Create anyway because the intended meaning is different.')
    await clickButton('Save and add to this match')

    expect(createAction).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('Counter press regain')
    expect(getInputByLabel('Remove Counter press regain').checked).toBe(true)
  })
})

function renderWizard(overrides: Partial<React.ComponentProps<typeof MatchDayWizard>> = {}) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  act(() => {
    root?.render(
      React.createElement(MatchDayWizard, {
        teams: [
          {
            id: 'team-1',
            clubId: 'club-1',
            name: 'Under 12s',
            clubName: 'Test FC',
            ageGroup: 'U12',
            inferredAgePhase: 'YOUTH' as const,
            players: [],
          },
        ],
        matchPhaseGroups: [
          {
            value: 'IN_POSSESSION' as const,
            label: 'In possession',
            events: [
              eventDefinition({
                id: 'event-goal',
                label: 'Goal',
                slug: 'goal',
                normalizedName: 'goal',
                category: 'SHOOTING',
                categoryLabel: 'Shooting',
                description: 'Record a scored goal.',
              }),
              eventDefinition({
                id: 'event-pass-complete',
                label: 'Pass complete',
                slug: 'pass-complete',
                normalizedName: 'pass complete',
                category: 'PASSING',
                categoryLabel: 'Passing',
                description: 'Record completed passes.',
              }),
              eventDefinition({
                id: 'event-press',
                label: 'Pressure regain',
                slug: 'pressure-regain',
                normalizedName: 'pressure regain',
                category: 'DEFENDING',
                categoryLabel: 'Defending',
                description: 'Regain the ball after pressure.',
              }),
            ],
          },
        ],
        previousSetups: [],
        validateTemplateAction: async () => ({ ok: true as const }),
        createAction: async () => undefined,
        ...overrides,
      })
    )
  })
}

function customOnlyPreviousSetup(overrides: Partial<ReturnType<typeof previousSetups>[number]> = {}) {
  return {
    id: 'custom-setup-1',
    teamId: 'team-1',
    teamName: 'Test FC',
    clubName: 'Test Club',
    opposition: 'Custom Rival',
    kickoffAt: '2026-02-01T10:30:00.000Z',
    eventTrackingScope: 'TEAM' as const,
    trackPlayerMinutes: false,
    locationTrackingEnabled: false,
    selectedEventDefinitionIds: [],
    selectedClubTrackingDefinitionIds: ['custom-1'],
    eventLabels: ['Lock the six'],
    players: [],
    ...overrides,
  }
}

function mixedPreviousSetup() {
  return {
    ...customOnlyPreviousSetup(),
    selectedEventDefinitionIds: ['event-pass-complete'],
    selectedClubTrackingDefinitionIds: ['custom-1'],
    eventLabels: ['Pass complete', 'Lock the six'],
  }
}

async function openPreviousSetupPicker() {
  await typeIntoInput(getInputByLabel('Opposition'), 'Rivals')
  await clickButton('Next')
  await clickButton('Next')
  await clickButton('Next')
  await clickButton('Use my last setup')
}

function teamOptions() {
  return [
    { id: 'team-1', clubId: 'club-1', name: 'Under 12s', clubName: 'Test FC', ageGroup: 'U12', inferredAgePhase: 'YOUTH' as const, players: [] },
    { id: 'team-2', clubId: 'club-1', name: 'Under 13s', clubName: 'Test FC', ageGroup: 'U13', inferredAgePhase: 'YOUTH' as const, players: [] },
  ]
}

function customObservation(overrides: Partial<{
  id: string
  clubId: string
  teamId: string | null
  visibilityScope: 'TEAM' | 'CLUB'
  label: string
  normalizedName: string
  countingDefinition: string | null
  guidance: string | null
  category: string | null
  categoryLabel: string
  polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  requiresLocation: boolean
  sourceLabel: 'Custom · Your team' | 'Custom · Your club'
}> = {}) {
  return {
    id: 'custom-1',
    clubId: 'club-1',
    teamId: 'team-1',
    visibilityScope: 'TEAM' as const,
    label: 'Lock the six',
    normalizedName: 'lock six',
    countingDefinition: 'Protect central space',
    guidance: null,
    category: 'DEFENDING',
    categoryLabel: 'Defending',
    polarity: 'POSITIVE' as const,
    requiresLocation: false,
    sourceLabel: 'Custom · Your team' as const,
    ...overrides,
  }
}

function eventDefinition(overrides: {
  id: string
  label: string
  slug: string
  normalizedName: string
  category: string
  categoryLabel: string
  description: string
}) {
  return {
    scope: 'GLOBAL' as const,
    clubId: null,
    subcategory: null,
    videoUrl: null,
    matchPhase: 'IN_POSSESSION' as const,
    matchPhaseLabel: 'In possession',
    agePhases: ['YOUTH' as const],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: true,
    ...overrides,
  }
}

function previousSetups() {
  return [
    {
      id: 'setup-1',
      teamId: 'team-1',
      teamName: 'Test FC',
      clubName: 'Test Club',
      opposition: 'Old Rival',
      kickoffAt: '2026-01-01T10:30:00.000Z',
      eventTrackingScope: 'TEAM' as const,
      trackPlayerMinutes: false,
      locationTrackingEnabled: false,
      selectedEventDefinitionIds: ['event-pass-complete'],
      eventLabels: ['Pass complete'],
      players: [],
    },
    {
      id: 'setup-2',
      teamId: 'team-1',
      teamName: 'Test FC',
      clubName: 'Test Club',
      opposition: 'Older Rival',
      kickoffAt: '2025-01-01T10:30:00.000Z',
      eventTrackingScope: 'TEAM' as const,
      trackPlayerMinutes: false,
      locationTrackingEnabled: false,
      selectedEventDefinitionIds: ['event-goal'],
      eventLabels: ['Goal'],
      players: [],
    },
  ]
}

async function clickButton(name: string) {
  const button = getButtonByText(name)

  await act(async () => {
    button.click()
  })
}

function getButtonByText(name: string) {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes(name))
  if (!button) throw new Error(`Button not found: ${name}`)

  return button
}

async function clickInput(label: string) {
  const input = getInputByLabel(label)
  await act(async () => {
    input.click()
  })
}

async function focusInput(input: HTMLInputElement) {
  await act(async () => {
    input.focus()
  })
}

async function clickInputByLabelText(label: string) {
  const input = Array.from(document.querySelectorAll('label')).find((element) => element.textContent?.includes(label))?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`Input not found: ${label}`)
  await act(async () => {
    input.click()
  })
}

async function typeIntoInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    inputValueSetter?.call(input, value)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value.at(-1) ?? null }))
  })
}

function getInputByLabel(label: string) {
  const input = document.querySelector(`input[aria-label="${label}"]`)
  if (input instanceof HTMLInputElement) return input

  const labelledInput = Array.from(document.querySelectorAll('label')).find((element) => element.textContent?.includes(label))?.querySelector('input')
  if (labelledInput instanceof HTMLInputElement) return labelledInput

  throw new Error(`Input not found: ${label}`)
}

async function typeIntoTextarea(label: string, value: string) {
  const textarea = Array.from(document.querySelectorAll('label')).find((element) => element.textContent?.includes(label))?.querySelector('textarea')
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error(`Textarea not found: ${label}`)
  await act(async () => {
    textarea.value = value
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value.at(-1) ?? null }))
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}
