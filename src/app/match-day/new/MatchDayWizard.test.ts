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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}
