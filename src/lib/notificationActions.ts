'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { archiveNotification, getNotificationForUser, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications'

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const refreshNotificationPaths = () => {
  revalidatePath('/')
  revalidatePath('/notifications')
  revalidatePath('/my-assignments')
}

export async function markNotificationReadAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) return
  const user = await getCurrentUser()
  await markNotificationRead(user.id, getText(formData, 'notificationId'))
  refreshNotificationPaths()
}

export async function markAllNotificationsReadAction() {
  if (!isMatchDayTrackingV2Enabled()) return
  const user = await getCurrentUser()
  await markAllNotificationsRead(user.id)
  refreshNotificationPaths()
}

export async function archiveNotificationAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) return
  const user = await getCurrentUser()
  await archiveNotification(user.id, getText(formData, 'notificationId'))
  refreshNotificationPaths()
}

export async function openNotificationAction(formData: FormData) {
  if (!isMatchDayTrackingV2Enabled()) redirect('/')
  const user = await getCurrentUser()
  const notification = await getNotificationForUser(user.id, getText(formData, 'notificationId'))
  if (!notification) redirect('/notifications?error=Notification%20was%20not%20found')
  await markNotificationRead(user.id, notification.id)
  refreshNotificationPaths()
  redirect(notification.href || '/notifications')
}
