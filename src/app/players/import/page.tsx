import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import PlayerImportClient from '@/app/players/import/PlayerImportClient'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleTeamWhere, getManageableTeamIds } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { canManageTeamData } from '@/lib/permissions'
import {
  buildPlayerImportPreview,
  getValidPlayerCreateRows,
  playerImportTemplate,
  type PlayerImportPreview,
} from '@/lib/playerImport'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type ImportPreviewRow = Omit<PlayerImportPreview['rows'][number], 'dateOfBirthValue'>

type ImportPreviewActionResult =
  | {
      ok: true
      rows: ImportPreviewRow[]
      validCount: number
      invalidCount: number
      warningCount: number
    }
  | { ok: false; reason: string }

type ImportConfirmActionResult =
  | { ok: true; importedCount: number; skippedCount: number; errorCount: number }
  | { ok: false; reason: string }

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function getExistingPlayersForImport(teamId: string) {
  return prisma.player.findMany({
    where: { teamId },
    select: {
      firstName: true,
      surname: true,
      squadNumber: true,
      dateOfBirth: true,
      isActive: true,
    },
  })
}

function serializePreview(preview: PlayerImportPreview): ImportPreviewActionResult {
  return {
    ok: true,
    rows: preview.rows.map((row) => ({
      rowNumber: row.rowNumber,
      firstName: row.firstName,
      surname: row.surname,
      squadNumber: row.squadNumber,
      position: row.position,
      dateOfBirth: row.dateOfBirth,
      errors: row.errors,
      warnings: row.warnings,
    })),
    validCount: preview.validCount,
    invalidCount: preview.invalidCount,
    warningCount: preview.warningCount,
  }
}

async function previewPlayerImport(formData: FormData): Promise<ImportPreviewActionResult> {
  'use server'

  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  const csvText = getTextValue(formData, 'csvText')

  if (!teamId) return { ok: false, reason: 'Choose a team before previewing.' }
  if (!(await canManageTeamData(user.id, teamId))) {
    return { ok: false, reason: 'You cannot import players into this team.' }
  }

  const existingPlayers = await getExistingPlayersForImport(teamId)
  const preview = buildPlayerImportPreview(csvText, existingPlayers)
  if (!preview.ok) return preview

  return serializePreview(preview)
}

async function confirmPlayerImport(formData: FormData): Promise<ImportConfirmActionResult> {
  'use server'

  const user = await getCurrentUser()
  const teamId = getTextValue(formData, 'teamId')
  const csvText = getTextValue(formData, 'csvText')

  if (!teamId) return { ok: false, reason: 'Choose a team before importing.' }
  if (!(await canManageTeamData(user.id, teamId))) {
    return { ok: false, reason: 'You cannot import players into this team.' }
  }

  const existingPlayers = await getExistingPlayersForImport(teamId)
  const preview = buildPlayerImportPreview(csvText, existingPlayers)
  if (!preview.ok) return { ok: false, reason: preview.reason }

  const validPlayers = getValidPlayerCreateRows(preview)
  if (validPlayers.length === 0) {
    return { ok: false, reason: 'There are no valid rows to import.' }
  }

  await prisma.$transaction(
    validPlayers.map((player) =>
      prisma.player.create({
        data: {
          teamId,
          ...player,
        },
      })
    )
  )

  revalidatePath('/players')
  revalidatePath('/players/import')

  return {
    ok: true,
    importedCount: validPlayers.length,
    skippedCount: preview.invalidCount,
    errorCount: preview.invalidCount,
  }
}

export default async function PlayerImportPage() {
  const user = await getCurrentUser()
  const manageableTeamIds = await getManageableTeamIds(user.id)
  const teams = await prisma.team.findMany({
    where: await accessibleTeamWhere(user.id),
    include: { club: true },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })
  const teamOptions = teams.filter((team) => manageableTeamIds.includes(team.id)).map((team) => ({
    id: team.id,
    name: team.name,
    clubName: team.club.name,
  }))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <div className="mb-6">
        <Link href="/players" className="text-sm font-semibold text-blue-800 hover:underline">
          Back to Players
        </Link>
      </div>
      <PageHeader
        title="Import Players"
        description="Upload, drop or paste CSV data, preview validation, then confirm before players are created."
      />

      {teamOptions.length === 0 ? (
        <EmptyState
          title="No manageable teams"
          description="You need club owner or coach access to a team before importing players."
        />
      ) : (
        <PlayerImportClient
          teams={teamOptions}
          template={playerImportTemplate}
          previewPlayerImportAction={previewPlayerImport}
          confirmPlayerImportAction={confirmPlayerImport}
        />
      )}
    </main>
  )
}
