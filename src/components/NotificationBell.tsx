import Link from 'next/link'

import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { getUnreadNotificationCount } from '@/lib/notifications'

export default async function NotificationBell({ userId }: { userId: string | null }) {
  if (!userId || !isMatchDayTrackingV2Enabled()) return null
  const unreadCount = await getUnreadNotificationCount(userId)

  return (
    <Link
      href="/notifications"
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      className="relative inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-slate-800 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a4 4 0 0 1 8 0c0 4 1.5 5 1.5 5h-11S6 12 6 8Z" />
        <path d="M8.5 16a2 2 0 0 0 3 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-black leading-none text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
