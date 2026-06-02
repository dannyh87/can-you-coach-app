import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function createClub(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const name = getTextValue(formData, 'name')
  const location = getTextValue(formData, 'location')
  const notes = getTextValue(formData, 'notes')

  if (!name) return

  await prisma.club.create({
    data: {
      userId: user.id,
      name,
      location: location || null,
      notes: notes || null,
    },
  })

  revalidatePath('/clubs')
}

async function updateClub(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')
  const name = getTextValue(formData, 'name')
  const location = getTextValue(formData, 'location')
  const notes = getTextValue(formData, 'notes')

  if (!id || !name) return

  const club = await prisma.club.findFirst({
    where: {
      id,
      userId: user.id,
    },
  })

  if (!club) return

  await prisma.club.update({
    where: { id },
    data: {
      name,
      location: location || null,
      notes: notes || null,
    },
  })

  revalidatePath('/clubs')
}

async function deleteClub(formData: FormData) {
  'use server'

  const user = await getLocalUser()
  const id = getTextValue(formData, 'id')

  if (!id) return

  const club = await prisma.club.findFirst({
    where: {
      id,
      userId: user.id,
    },
  })

  if (!club) return

  await prisma.club.delete({
    where: { id },
  })

  revalidatePath('/clubs')
  revalidatePath('/teams')
}

export default async function ClubsPage() {
  const user = await getLocalUser()
  await ensureDefaultClub(user.id)

  const clubs = await prisma.club.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          teams: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clubs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage clubs before adding teams.
          </p>
        </div>

        <Link href="/teams" className="text-sm text-blue-600 hover:underline">
          Manage Teams
        </Link>
      </div>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 text-xl font-bold">Create Club</h2>

        <form action={createClub} className="grid gap-3">
          <label className="text-sm font-medium">
            Club name
            <input
              name="name"
              required
              className="mt-1 w-full rounded border p-2"
              placeholder="e.g. Brereton Social FC"
            />
          </label>

          <label className="text-sm font-medium">
            Location
            <input
              name="location"
              className="mt-1 w-full rounded border p-2"
              placeholder="Optional"
            />
          </label>

          <label className="text-sm font-medium">
            Notes
            <textarea
              name="notes"
              className="mt-1 w-full rounded border p-2"
              placeholder="Optional"
              rows={3}
            />
          </label>

          <button className="rounded bg-blue-600 px-4 py-2 font-medium text-white">
            Create Club
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Existing Clubs</h2>

        {clubs.map((club) => (
          <article key={club.id} className="rounded-lg border p-4">
            <form action={updateClub} className="grid gap-3">
              <input type="hidden" name="id" value={club.id} />

              <label className="text-sm font-medium">
                Club name
                <input
                  name="name"
                  required
                  defaultValue={club.name}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>

              <label className="text-sm font-medium">
                Location
                <input
                  name="location"
                  defaultValue={club.location ?? ''}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>

              <label className="text-sm font-medium">
                Notes
                <textarea
                  name="notes"
                  defaultValue={club.notes ?? ''}
                  className="mt-1 w-full rounded border p-2"
                  rows={3}
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-gray-500">
                  {club._count.teams} teams
                </span>

                <div className="flex gap-2">
                  <button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white">
                    Save
                  </button>
                </div>
              </div>
            </form>

            <form action={deleteClub} className="mt-3">
              <input type="hidden" name="id" value={club.id} />
              <button className="text-sm font-medium text-red-600 hover:underline">
                Delete Club
              </button>
            </form>
          </article>
        ))}
      </section>
    </main>
  )
}
