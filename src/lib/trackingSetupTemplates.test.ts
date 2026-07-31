import { describe, expect, it, vi } from 'vitest'

import { applyTrackingTemplateToMatch, createTemplateFromMatchTasks } from '@/lib/trackingSetupTemplates'

vi.mock('@/lib/features', () => ({ isMatchDayTrackingV2Enabled: () => true }))
vi.mock('@/lib/permissions', () => ({
  canManageMatchDay: vi.fn(async () => true),
  canManageTeamData: vi.fn(async () => true),
  canViewTeam: vi.fn(async () => true),
  isOwnerForClub: vi.fn(async () => true),
}))

function baseDb(overrides: Record<string, unknown> = {}) {
  const db = {
    clubMembership: { findMany: async () => [{ clubId: 'club-1', role: 'COACH', teamAssignments: [{ teamId: 'team-1' }] }] },
    team: { findMany: async () => [] },
    eventDefinition: { findMany: async () => [{ id: 'event-1', legacyEventType: 'SHOT', category: 'ATTACKING', defaultCategory: 'ATTACKING' }] },
    trackingPatternDefinition: { findMany: async () => [{ id: 'pattern-1' }] },
    eventTopic: { findMany: async () => [{ id: 'topic-1' }] },
    matchDayPlayer: { findMany: async () => [{ playerId: 'player-2' }] },
    matchTrackingTask: { findMany: async () => [] },
    trackingSetupTemplateApplication: { findUnique: async () => null, create: async () => ({ id: 'application-1' }) },
    matchDayEventType: { upsert: async () => ({ id: 'match-event-type-1' }) },
    matchTrackingTaskEvent: { createMany: vi.fn(async () => ({ count: 1 })) },
    matchTrackingTaskPattern: { createMany: vi.fn(async () => ({ count: 1 })) },
    matchContributorAssignment: { create: vi.fn() },
    submittedTrackingEventObservation: { create: vi.fn() },
    submittedTrackingPatternObservation: { create: vi.fn() },
    matchTrackingTaskEventObservation: { create: vi.fn() },
    matchTrackingPatternObservation: { create: vi.fn() },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    ...overrides,
  }
  return db as never
}

describe('tracking setup templates', () => {
  it('creates a template from match tasks without storing player IDs or assignments', async () => {
    const createdTaskData: Record<string, unknown>[] = []
    const db = baseDb({
      matchDay: { findUnique: async () => ({ teamId: 'team-1', team: { clubId: 'club-1' } }) },
      matchTrackingTask: {
        findMany: async () => [{
          id: 'task-1', scopeType: 'PLAYER', playerId: 'player-1', player: { preferredPosition: 'Centre forward' }, unitKey: null, unitLabel: null, topicId: 'topic-1', title: 'Finishing', instructions: 'Track finishing',
          events: [{ matchDayEventType: { eventDefinitionId: 'event-1' } }],
          patterns: [{ patternId: 'pattern-1' }],
        }],
      },
      trackingSetupTemplate: { create: async () => ({ id: 'template-1' }) },
      trackingSetupTemplateTask: { create: async ({ data }: { data: Record<string, unknown> }) => { createdTaskData.push(data); return { id: 'template-task-1' } } },
      trackingSetupTemplateTaskEvent: { createMany: vi.fn() },
      trackingSetupTemplateTaskPattern: { createMany: vi.fn() },
    })

    const result = await createTemplateFromMatchTasks({ db, userId: 'coach-1', matchDayId: 'match-1', taskIds: ['task-1'], name: 'CYCV2-TEMPLATE-test', visibility: 'PERSONAL' })

    expect(result).toMatchObject({ ok: true, value: { id: 'template-1' } })
    expect(createdTaskData[0]).not.toHaveProperty('playerId')
    expect(createdTaskData[0]).toMatchObject({ scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD' })
  })

  it('reloads an existing application for the same idempotency key', async () => {
    const db = baseDb({
      trackingSetupTemplateApplication: { findUnique: async () => ({ id: 'application-1', templateId: 'template-1', matchDayId: 'match-1', appliedByUserId: 'coach-1', createdTasks: [{ id: 'task-1' }] }) },
    })

    const result = await applyTrackingTemplateToMatch({ db, userId: 'coach-1', templateId: 'template-1', matchDayId: 'match-1', idempotencyKey: 'same-key-12345678', mappings: [] })

    expect(result).toMatchObject({ ok: true, value: { applicationId: 'application-1', taskIds: ['task-1'] } })
  })

  it('applies mixed template tasks without creating assignments or observations', async () => {
    const taskCreate = vi.fn(async () => ({ id: 'created-task-1' }))
    const assignmentCreate = vi.fn()
    const observationCreate = vi.fn()
    const db = baseDb({
      matchDay: { findUnique: async () => ({ id: 'match-1', status: 'DRAFT', teamId: 'team-1', team: { clubId: 'club-1' } }) },
      trackingSetupTemplate: {
        findFirst: async () => ({
          id: 'template-1', name: 'Template', description: null, visibility: 'TEAM', clubId: 'club-1', teamId: 'team-1', team: { name: 'U12' }, active: true, archivedAt: null, revision: 1, updatedAt: new Date(), applications: [],
          tasks: [{ id: 'template-task-1', scopeType: 'PLAYER', targetContext: 'CENTRE_FORWARD', unitKey: null, unitLabel: null, topicId: 'topic-1', topic: { name: 'Finishing' }, title: 'Finishing', instructions: null, displayOrder: 0, events: [{ eventDefinitionId: 'event-1', displayOrder: 0, eventDefinition: { name: 'Shot', isActive: true, archivedAt: null } }], patterns: [{ patternId: 'pattern-1', displayOrder: 0, pattern: { name: 'Third man run', active: true, aliases: [] } }] }],
        }),
      },
      matchTrackingTask: { findMany: async () => [], create: taskCreate },
      matchContributorAssignment: { create: assignmentCreate },
      submittedTrackingEventObservation: { create: observationCreate },
      submittedTrackingPatternObservation: { create: observationCreate },
    })

    const result = await applyTrackingTemplateToMatch({ db, userId: 'coach-1', templateId: 'template-1', matchDayId: 'match-1', idempotencyKey: 'apply-key-12345678', mappings: [{ templateTaskId: 'template-task-1', playerIds: ['player-2'] }] })

    expect(result.ok).toBe(true)
    expect(taskCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ playerId: 'player-2', templateApplicationId: 'application-1', sourceTemplateTaskId: 'template-task-1' }) }))
    expect(assignmentCreate).not.toHaveBeenCalled()
    expect(observationCreate).not.toHaveBeenCalled()
  })
})
