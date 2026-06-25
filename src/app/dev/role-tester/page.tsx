import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentAccessSummary } from '@/lib/accessSummary'
import { getOptionalCurrentUser, isClerkEnabled } from '@/lib/auth'
import {
  canSwitchRoleTesterUser,
  ensureRoleTesterData,
  isRoleTesterEnabled,
  ROLE_TESTER_COOKIE,
  roleTesterScenarios,
} from '@/lib/roleTester'

export const dynamic = 'force-dynamic'

async function switchRoleTesterUser(formData: FormData) {
  'use server'

  if (!canSwitchRoleTesterUser()) return

  const email = formData.get('email')
  if (typeof email !== 'string') return

  const scenario = roleTesterScenarios.find((roleTesterScenario) => roleTesterScenario.email === email)
  if (!scenario) return

  await ensureRoleTesterData()
  const cookieStore = await cookies()
  cookieStore.set(ROLE_TESTER_COOKIE, scenario.email, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  redirect('/dev/role-tester')
}

export default async function RoleTesterPage() {
  if (!isRoleTesterEnabled()) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
        <PageHeader title="Role tester disabled" description="Set ENABLE_ROLE_TESTER=true to enable this local development tool." />
      </main>
    )
  }

  if (isClerkEnabled()) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
        <PageHeader title="Role tester unavailable" description="User switching is only available when Clerk is disabled." />
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Clerk is enabled, so this tool will not override the authenticated user. Use real Clerk accounts for deployed testing.
        </p>
      </main>
    )
  }

  await ensureRoleTesterData()
  const user = await getOptionalCurrentUser()
  const accessSummary = user ? await getCurrentAccessSummary(user) : null
  const selectedEmail = user?.email ?? 'Unknown user'

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader title="Development Role Tester" description="Switch between real local database users to test server-side permissions." />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
        <h2 className="font-bold">Development role tester enabled. This is for local/testing only.</h2>
        <p className="mt-1">Switching changes the real local current user. Existing server-side permission checks still apply.</p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Current user</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedEmail}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Access: <span className="font-bold text-slate-950">{accessSummary?.label ?? 'No club access'}</span>
        </p>
        {accessSummary?.title && accessSummary.title !== accessSummary.label && (
          <p className="mt-1 text-sm text-slate-500">{accessSummary.title}</p>
        )}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {roleTesterScenarios.map((scenario) => (
          <form key={scenario.key} action={switchRoleTesterUser} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input type="hidden" name="email" value={scenario.email} />
            <p className="text-lg font-bold text-slate-950">{scenario.label}</p>
            <p className="mt-1 text-sm text-slate-600">{scenario.description}</p>
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs font-semibold text-slate-500">{scenario.email}</p>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
            >
              Switch user
            </button>
          </form>
        ))}
      </section>
    </main>
  )
}
