// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

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
    expect(document.body.textContent).toContain('1 of 8 selected')

    await typeIntoInput(searchInput, '')

    expect(searchInput.value).toBe('')
    expect(document.activeElement).toBe(searchInput)
    expect(document.body.textContent).toContain('Goal')
    expect(getInputByLabel('Remove Pass complete').checked).toBe(true)
  })
})

function renderWizard() {
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

async function clickButton(name: string) {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes(name))
  if (!button) throw new Error(`Button not found: ${name}`)

  await act(async () => {
    button.click()
  })
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
