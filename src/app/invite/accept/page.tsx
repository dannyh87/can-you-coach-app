import Link from 'next/link'
import type { ReactNode } from 'react'

import PageHeader from '@/components/ui/PageHeader'
import { getOptionalCurrentUser } from '@/lib/auth'
import { acceptInvitation, getInvitationAcceptPath } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)

const formatInviteType = (type: string) => {
  if (type === 'TEAM_COACH') return 'Coach team invite'
  if (type === 'TEAM_ASSISTANT') return 'Assistant coach team invite'
  if (type === 'PLAYER_PARENT') return 'Parent player invite'
  return 'Spectator player invite'
}

const getSuccessHref = (type: string) =>
  type === 'PLAYER_PARENT' || type === 'PLAYER_SPECTATOR' ? '/my-player' : '/'

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  const invitePath = token ? getInvitationAcceptPath(token) : '/invite/accept'

  if (!token) {
    return <InviteShell title="Invalid invite" message="This invite link is missing its token." />
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      club: { select: { name: true } },
      team: { select: { name: true } },
      player: { select: { firstName: true, surname: true, team: { select: { name: true } } } },
    },
  })

  if (!invitation) {
    return <InviteShell title="Invalid invite" message="This invite link was not found or is no longer available." />
  }

  if (invitation.status === 'REVOKED') {
    return <InviteShell title="Invite revoked" message="This invite has been revoked by the club owner." />
  }

  if (invitation.status === 'ACCEPTED') {
    return <InviteShell title="Invite already accepted" message="This invite has already been accepted." />
  }

  if (invitation.status === 'EXPIRED' || invitation.expiresAt < new Date()) {
    if (invitation.status === 'PENDING') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
    }

    return <InviteShell title="Invite expired" message="This invite has expired. Ask the club owner to generate a new link." />
  }

  const user = await getOptionalCurrentUser()
  const inviteSummary = <InviteSummary invitation={invitation} />

  if (!user) {
    const returnUrl = encodeURIComponent(invitePath)

    return (
      <InviteShell title="Accept your invite" message="Sign in or create an account with the invited email address to accept this invite.">
        {inviteSummary}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/sign-in?redirect_url=${returnUrl}`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            Sign in
          </Link>
          <Link href={`/sign-up?redirect_url=${returnUrl}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50">
            Sign up
          </Link>
        </div>
      </InviteShell>
    )
  }

  const result = await acceptInvitation({ token, userId: user.id, userEmail: user.email })

  if (result.status === 'accepted') {
    const href = getSuccessHref(result.type)

    return (
      <InviteShell title="Invite accepted" message="Your access has been added successfully.">
        <Link href={href} className="mt-5 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
          Continue
        </Link>
      </InviteShell>
    )
  }

  if (result.status === 'email_mismatch') {
    return (
      <InviteShell title="Wrong signed-in email" message="This invite can only be accepted by the email address it was sent to.">
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p><span className="font-bold">Invited email:</span> {result.invitedEmail}</p>
          <p className="mt-1"><span className="font-bold">Signed-in email:</span> {result.signedInEmail}</p>
          <p className="mt-3">Sign out, then sign in with the invited email address to accept this invite.</p>
        </div>
      </InviteShell>
    )
  }

  if (result.status === 'revoked') {
    return <InviteShell title="Invite revoked" message="This invite has been revoked by the club owner." />
  }

  if (result.status === 'expired') {
    return <InviteShell title="Invite expired" message="This invite has expired. Ask the club owner to generate a new link." />
  }

  if (result.status === 'already_accepted') {
    return <InviteShell title="Invite already accepted" message="This invite has already been accepted." />
  }

  if (result.status === 'error') {
    return <InviteShell title="Invite could not be accepted" message={result.reason} />
  }

  return <InviteShell title="Invalid invite" message="This invite link was not found or is no longer available." />
}

function InviteShell({
  title,
  message,
  children,
}: {
  title: string
  message: string
  children?: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:p-6">
      <PageHeader title={title} description={message} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">{message}</p>
        {children}
      </section>
    </main>
  )
}

function InviteSummary({
  invitation,
}: {
  invitation: {
    type: string
    email: string
    expiresAt: Date
    club: { name: string } | null
    team: { name: string } | null
    player: { firstName: string; surname: string; team: { name: string } } | null
  }
}) {
  const target = invitation.team
    ? invitation.team.name
    : invitation.player
      ? `${invitation.player.firstName} ${invitation.player.surname} (${invitation.player.team.name})`
      : 'Not available'

  return (
    <dl className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-bold text-slate-500">Invite type</dt>
        <dd className="mt-1 text-slate-950">{formatInviteType(invitation.type)}</dd>
      </div>
      <div>
        <dt className="font-bold text-slate-500">Invited email</dt>
        <dd className="mt-1 text-slate-950">{invitation.email}</dd>
      </div>
      <div>
        <dt className="font-bold text-slate-500">Club</dt>
        <dd className="mt-1 text-slate-950">{invitation.club?.name ?? 'Not available'}</dd>
      </div>
      <div>
        <dt className="font-bold text-slate-500">Target</dt>
        <dd className="mt-1 text-slate-950">{target}</dd>
      </div>
      <div>
        <dt className="font-bold text-slate-500">Expires</dt>
        <dd className="mt-1 text-slate-950">{formatDate(invitation.expiresAt)}</dd>
      </div>
    </dl>
  )
}
