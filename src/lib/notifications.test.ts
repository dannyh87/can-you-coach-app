import { describe, expect, it } from 'vitest'

import { createNotification, createNotificationsForUsers, markNotificationRead } from '@/lib/notifications'

function createDb() {
  const rows: Array<{ id: string; userId: string; dedupeKey: string | null; readAt: Date | null }> = []
  let counter = 0
  const db = {
    notification: {
      upsert: async ({ where, update, create }: { where: { userId_dedupeKey: { userId: string; dedupeKey: string } }; update: Record<string, unknown>; create: { userId: string; dedupeKey: string | null } }) => {
        const existing = rows.find((row) => row.userId === where.userId_dedupeKey.userId && row.dedupeKey === where.userId_dedupeKey.dedupeKey)
        if (existing) {
          Object.assign(existing, update)
          return { id: existing.id }
        }
        const row = { id: `notification-${++counter}`, userId: create.userId, dedupeKey: create.dedupeKey, readAt: null }
        rows.push(row)
        return { id: row.id }
      },
      create: async ({ data }: { data: { userId: string; dedupeKey: string | null } }) => {
        const row = { id: `notification-${++counter}`, userId: data.userId, dedupeKey: data.dedupeKey, readAt: null }
        rows.push(row)
        return { id: row.id }
      },
      updateMany: async ({ where, data }: { where: { id: string; userId: string }; data: { readAt: Date } }) => {
        const row = rows.find((candidate) => candidate.id === where.id && candidate.userId === where.userId)
        if (!row) return { count: 0 }
        row.readAt = data.readAt
        return { count: 1 }
      },
    },
    rows,
  }
  return db as never as typeof db & Parameters<typeof createNotification>[1]
}

describe('notifications', () => {
  it('deduplicates repeated notifications for the same user and dedupe key', async () => {
    const db = createDb()
    const input = { userId: 'user-1', type: 'TRACKING_DIRECT_ASSIGNED' as const, title: 'Assigned', dedupeKey: 'assignment-1:user-1' }

    expect((await createNotification(input, db)).ok).toBe(true)
    expect((await createNotification(input, db)).ok).toBe(true)
    expect(db.rows).toHaveLength(1)
  })

  it('allows different lifecycle notifications for the same assignment', async () => {
    const db = createDb()
    await createNotification({ userId: 'user-1', type: 'TRACKING_DIRECT_ASSIGNED', title: 'Assigned', dedupeKey: 'assignment-1:assigned:user-1' }, db)
    await createNotification({ userId: 'user-1', type: 'TRACKING_ASSIGNMENT_CANCELLED', title: 'Cancelled', dedupeKey: 'assignment-1:cancelled:user-1' }, db)

    expect(db.rows).toHaveLength(2)
  })

  it('creates notifications only for intended recipients', async () => {
    const db = createDb()
    const result = await createNotificationsForUsers([
      { userId: 'user-1', type: 'TRACKING_GROUP_OFFERED', title: 'Offer' },
      { userId: 'user-2', type: 'TRACKING_GROUP_OFFERED', title: 'Offer' },
    ], db)

    expect(result).toMatchObject({ ok: true, value: { count: 2 } })
    expect(db.rows.map((row) => row.userId)).toEqual(['user-1', 'user-2'])
  })

  it('marks only the current user notification as read', async () => {
    const db = createDb()
    const created = await createNotification({ userId: 'user-1', type: 'TRACKING_DIRECT_ASSIGNED', title: 'Assigned' }, db)
    if (!created.ok) throw new Error('failed')

    expect((await markNotificationRead('other-user', created.value.id, db)).ok).toBe(false)
    expect((await markNotificationRead('user-1', created.value.id, db)).ok).toBe(true)
  })
})
