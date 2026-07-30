import { notFound } from 'next/navigation'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { archiveNotificationAction, markAllNotificationsReadAction, markNotificationReadAction, openNotificationAction } from '@/lib/notificationActions'
import { getNotificationsForUser } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const formatDateTime = (date: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)

const formatType = (type: string) => type.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ')

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const [query, notifications] = await Promise.all([searchParams, getNotificationsForUser(user.id)])
  const unread = notifications.filter((notification) => !notification.readAt)
  const earlier = notifications.filter((notification) => notification.readAt)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader title="Notifications" description="Match Day assignment updates and review alerts appear here." />
      {query.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{query.error}</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        <form action={markAllNotificationsReadAction}>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">Mark all as read</button>
        </form>
      </div>
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="Match Day assignment updates will appear here." />
      ) : (
        <div className="space-y-6">
          <NotificationGroup title="New" notifications={unread} />
          <NotificationGroup title="Earlier" notifications={earlier} />
        </div>
      )}
    </main>
  )
}

function NotificationGroup({ title, notifications }: { title: string; notifications: Awaited<ReturnType<typeof getNotificationsForUser>> }) {
  if (notifications.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3 space-y-3">
        {notifications.map((notification) => {
          const resolved = notification.assignment && ['DECLINED', 'SUBMITTED', 'CANCELLED'].includes(notification.assignment.status)
          const unavailable = !notification.assignmentId && !notification.matchDayId
          return (
            <article key={notification.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${notification.readAt ? 'border-slate-200' : 'border-emerald-200 ring-1 ring-emerald-100'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{formatType(notification.type)}</p>
                  <h3 className="mt-1 break-words text-lg font-extrabold text-slate-950">{notification.title}</h3>
                  {notification.body && <p className="mt-1 break-words text-sm leading-6 text-slate-600">{notification.body}</p>}
                  <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(notification.createdAt)}</p>
                  {resolved && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm font-semibold text-slate-700">This assignment is now {notification.assignment?.status.toLowerCase()}.</p>}
                  {unavailable && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm font-semibold text-slate-700">This item is no longer available.</p>}
                </div>
                {!notification.readAt && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Unread</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {notification.href && (
                  <form action={openNotificationAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800">Open</button>
                  </form>
                )}
                {!notification.readAt && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Mark read</button>
                  </form>
                )}
                <form action={archiveNotificationAction}>
                  <input type="hidden" name="notificationId" value={notification.id} />
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Archive</button>
                </form>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
