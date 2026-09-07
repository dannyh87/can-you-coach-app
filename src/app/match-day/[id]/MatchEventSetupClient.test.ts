// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MatchEventSetupClient from '@/app/match-day/[id]/MatchEventSetupClient'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('MatchEventSetupClient mixed selections', () => {
  it('uses prefixed keys and submits standard and custom identities separately', async () => {
    const updateAction = vi.fn(async (formData: FormData) => { void formData; return { ok: true as const } })
    renderClient(updateAction)

    expect(getCheckbox('Remove Pass complete').checked).toBe(true)
    expect(getCheckbox('Remove Lock the six').checked).toBe(true)

    await clickButton('Save event setup')

    const formData = updateAction.mock.calls[0][0] as FormData
    expect(formData.getAll('eventDefinitionId')).toEqual(['event-1'])
    expect(formData.getAll('clubTrackingDefinitionId')).toEqual(['custom-1'])
  })
})

function renderClient(updateMatchEventSetupAction: (formData: FormData) => Promise<{ ok: true } | { ok: false; reason: string }>) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root?.render(React.createElement(MatchEventSetupClient, {
      matchDayId: 'match-1',
      eventOptions: [{ id: 'event-1', label: 'Pass complete', scope: 'GLOBAL', clubId: null, slug: 'pass-complete', normalizedName: 'complete pas', category: 'PASSING', categoryLabel: 'Passing', subcategory: null, description: 'Count passes', videoUrl: null, matchPhase: 'IN_POSSESSION', matchPhaseLabel: 'In possession', agePhases: [], fourCorner: 'TECHNICAL', positionRelevance: [], requiresLocation: false, enabledByDefault: true, legacyEventType: 'PASS_COMPLETE', matchDayGroup: 'PASSING', matchDayGroupLabel: 'Passing', isActive: true }],
      customEventOptions: [{ id: 'custom-1', label: 'Lock the six', description: 'Protect central space', category: 'DEFENDING', categoryLabel: 'Defending', subcategory: 'Custom · Your team', requiresLocation: false, sourceLabel: 'Custom · Your team' }],
      categoryOptions: [{ value: 'PASSING', label: 'Passing' }, { value: 'DEFENDING', label: 'Defending' }],
      selectedEventDefinitionIds: ['event-1'],
      selectedClubTrackingDefinitionIds: ['custom-1'],
      updateMatchEventSetupAction,
    }))
  })
}

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  await act(async () => button.click())
}

function getCheckbox(label: string) {
  const input = document.querySelector(`input[aria-label="${label}"]`)
  if (input instanceof HTMLInputElement) return input
  const labelledInput = Array.from(document.querySelectorAll('label')).find((element) => element.textContent?.includes(label.replace(/^Remove /, '')))?.querySelector('input')
  if (labelledInput instanceof HTMLInputElement) return labelledInput
  throw new Error(`Checkbox not found: ${label}`)
}
