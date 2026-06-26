import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'
import { isRoleTesterEnabled } from '@/lib/roleTester'

export const dynamic = 'force-dynamic'

export default function DevToolsPage() {
  if (!isRoleTesterEnabled()) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
        <PageHeader title="Dev Tools disabled" description="Set ENABLE_ROLE_TESTER=true to enable local development tools." />
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Super Admin Dev Tools"
        description="Development-only utilities for testing permissions and admin workflows."
      />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
        <h2 className="font-bold">Development only.</h2>
        <p className="mt-1">These tools are available only when ENABLE_ROLE_TESTER=true and should not be treated as production settings.</p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <ToolCard
          href="/super-admin/events"
          title="Event Library"
          eyebrow="Super Admin"
          description="Manage global match event definitions and recordable event metadata."
        />
        <ToolCard
          href="/super-admin/dev-tools/role-tester"
          title="Dev Role Tester"
          eyebrow="Development"
          description="Switch between seeded local test users to test permissions and role-specific journeys."
        />
      </section>
    </main>
  )
}

function ToolCard({
  href,
  eyebrow,
  title,
  description,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-extrabold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  )
}
