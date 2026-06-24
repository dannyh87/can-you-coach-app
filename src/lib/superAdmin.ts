import { isClerkEnabled } from '@/lib/auth'

const localDevelopmentSuperAdminEmail = 'local-coach@can-you-coach.local'

export function getSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function canManageGlobalEventLibrary(user: { email: string }) {
  const allowedEmails = getSuperAdminEmails()
  const userEmail = user.email.toLowerCase()

  if (allowedEmails.length > 0) return allowedEmails.includes(userEmail)

  return !isClerkEnabled() && userEmail === localDevelopmentSuperAdminEmail
}
