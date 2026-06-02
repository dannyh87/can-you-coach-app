import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const formatDate = (date: Date | null) => {
  if (!date) return 'Not set'
  return new Intl.DateTimeFormat('en-GB').format(date)
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getLocalUser()

  const player = await prisma.player.findFirst({
    where: {
      id,
      team: {
        club: {
          userId: user.id,
        },
      },
    },
    include: {
      team: {
        include: {
          club: true,
        },
      },
    },
  })

  if (!player) notFound()

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link href="/players" className="text-sm text-blue-600 hover:underline">
        Back to Players
      </Link>

      <section className="mt-6 rounded-xl border p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">
              {player.firstName} {player.surname}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {player.team.club.name} / {player.team.name}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              player.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {player.isActive ? 'Active' : 'Archived'}
          </span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <dt className="text-sm text-gray-500">Squad Number</dt>
            <dd className="mt-1 text-xl font-bold">{player.squadNumber}</dd>
          </div>

          <div className="rounded-lg border p-4">
            <dt className="text-sm text-gray-500">Preferred Position</dt>
            <dd className="mt-1 text-xl font-bold">
              {player.preferredPosition ?? 'Not set'}
            </dd>
          </div>

          <div className="rounded-lg border p-4">
            <dt className="text-sm text-gray-500">Date of Birth</dt>
            <dd className="mt-1 text-xl font-bold">
              {formatDate(player.dateOfBirth)}
            </dd>
          </div>

          <div className="rounded-lg border p-4">
            <dt className="text-sm text-gray-500">Joined Club</dt>
            <dd className="mt-1 text-xl font-bold">
              {formatDate(player.joinedClubDate)}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-gray-500">
          Fitness history and match statistics will be added in later phases.
        </p>
      </section>
    </main>
  )
}
