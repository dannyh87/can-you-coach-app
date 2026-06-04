import Link from 'next/link'

const setupLinks = [
  {
    href: '/clubs',
    title: 'Clubs',
    description: 'Create and manage clubs for the local MVP workspace.',
  },
  {
    href: '/teams',
    title: 'Teams',
    description: 'Create teams inside clubs before adding players.',
  },
  {
    href: '/players',
    title: 'Players',
    description: 'Add, edit, archive and restore players inside teams.',
  },
  {
    href: '/fitness',
    title: 'Fitness',
    description: 'Create and review fitness test sessions for teams.',
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center p-6">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-blue-600">Can You Coach</p>
        <h1 className="text-4xl font-bold tracking-tight">Home</h1>
        <p className="mt-3 text-gray-600">
          Use this home page to move around the MVP. Start by creating a club,
          then add teams, players and fitness test sessions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {setupLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border p-5 transition hover:border-blue-500 hover:bg-blue-50"
          >
            <h2 className="text-xl font-bold">{link.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{link.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
