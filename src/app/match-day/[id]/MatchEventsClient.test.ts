// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MatchEventsClient from '@/app/match-day/[id]/MatchEventsClient'

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

describe('MatchEventsClient custom recording', () => {
  it('submits custom identities without standard or legacy fields', async () => {
    const recordAction = vi.fn(async (formData: FormData) => { void formData; return { ok: true as const } })
    renderClient(recordAction)

    await clickButton('Lock the six')

    const formData = recordAction.mock.calls[0][0] as FormData
    expect(formData.get('clubTrackingDefinitionId')).toBe('custom-1')
    expect(formData.get('eventDefinitionId')).toBeNull()
    expect(formData.get('eventType')).toBeNull()
  })

  it('submits opposition side and optional tactical detail without a player', async () => {
    const recordAction = vi.fn(async (formData: FormData) => { void formData; return { ok: true as const } })
    renderClient(recordAction, async () => ({ ok: true }), {
      players: [{ matchDayPlayerId: 'match-player-1', playerId: 'player-1', firstName: 'Alex', surname: 'One' }],
      eventOptions: [{ matchDayEventTypeId: 'selected-2', eventDefinitionId: 'event-final-third-entry', clubTrackingDefinitionId: null, legacyEventType: null, label: 'Final-third entry by pass', category: 'IN_POSSESSION', categoryLabel: 'In possession', subcategory: null, description: 'Entry by pass', videoUrl: null, requiresLocation: false, tacticalDetailOptions: [{ code: 'LEFT', label: 'Left' }] }],
      categoryOptions: [{ value: 'IN_POSSESSION', label: 'In possession' }],
    })

    await clickButton('Opposition')
    await clickButton('Left')
    await clickButton('Final-third entry by pass')

    const formData = recordAction.mock.calls[0][0] as FormData
    expect(formData.get('eventDefinitionId')).toBe('event-final-third-entry')
    expect(formData.get('teamSide')).toBe('OPPOSITION')
    expect(formData.get('detailCode')).toBe('LEFT')
    expect(formData.get('matchDayPlayerId')).toBeNull()
  })

  it('keeps undo/delete available for recorded custom events', async () => {
    const deleteAction = vi.fn(async (formData: FormData) => { void formData; return { ok: true as const } })
    renderClient(async () => ({ ok: true as const }), deleteAction)

    await clickButton('Undo')

    const formData = deleteAction.mock.calls[0][0] as FormData
    expect(formData.get('matchEventId')).toBe('event-recorded-1')
  })
})

function renderClient(
  recordMatchEventAction: (formData: FormData) => Promise<{ ok: true } | { ok: false; reason: string }>,
  deleteMatchEventAction: (formData: FormData) => Promise<{ ok: true } | { ok: false; reason: string }> = async () => ({ ok: true }),
  overrides: Partial<React.ComponentProps<typeof MatchEventsClient>> = {}
) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root?.render(React.createElement(MatchEventsClient, {
      matchDayId: 'match-1',
      status: 'IN_PROGRESS',
      players: [],
      allowTeamEvents: true,
      events: [{ id: 'event-recorded-1', label: 'Lock the six', half: 'FIRST_HALF', matchSecond: 10, ownScoreAtTime: 0, oppositionScoreAtTime: 0, playerName: 'Whole team' }],
      eventOptions: [{ matchDayEventTypeId: 'selected-1', eventDefinitionId: null, clubTrackingDefinitionId: 'custom-1', legacyEventType: null, label: 'Lock the six', category: 'OUT_OF_POSSESSION', categoryLabel: 'Defending', subcategory: 'Custom · Your team', description: 'Protect central space', videoUrl: null, requiresLocation: false, tacticalDetailOptions: [] }],
      categoryOptions: [{ value: 'OUT_OF_POSSESSION', label: 'Defending' }],
      recordMatchEventAction,
      deleteMatchEventAction,
      ...overrides,
    }))
  })
}

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  await act(async () => button.click())
}
