import { isPlayerPosition } from '@/lib/playerPositions'

export const playerImportTemplate = `firstName,surname,squadNumber,position,dateOfBirth
Harry,Smith,7,Forward,2014-05-12
Jack,Jones,4,Defender,2014-02-01`

export const maxPlayerImportRows = 100

export type ExistingImportPlayer = {
  firstName: string
  surname: string
  squadNumber: number | null
  dateOfBirth: Date | null
  isActive: boolean
}

export type PlayerImportRow = {
  rowNumber: number
  firstName: string
  surname: string
  squadNumber: number | null
  position: string
  dateOfBirth: string
  dateOfBirthValue: Date | null
  errors: string[]
  warnings: string[]
}

export type PlayerImportPreview = {
  ok: true
  rows: PlayerImportRow[]
  validCount: number
  invalidCount: number
  warningCount: number
}

export type PlayerImportError = {
  ok: false
  reason: string
}

export type PlayerImportResult = PlayerImportPreview | PlayerImportError

type HeaderKey = 'firstName' | 'surname' | 'name' | 'squadNumber' | 'position' | 'dateOfBirth'

const headerAliases: Record<string, HeaderKey> = {
  firstname: 'firstName',
  surname: 'surname',
  lastname: 'surname',
  name: 'name',
  fullname: 'name',
  playername: 'name',
  squadnumber: 'squadNumber',
  shirtnumber: 'squadNumber',
  position: 'position',
  preferredposition: 'position',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
}

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeDuplicateText = (value: string) => normalizeText(value).toLowerCase()

const getDateKey = (date: Date | null) => date ? date.toISOString().slice(0, 10) : ''

const getExactDuplicateKey = (firstName: string, surname: string, dateOfBirth: Date | null) =>
  `${normalizeDuplicateText(firstName)}|${normalizeDuplicateText(surname)}|${getDateKey(dateOfBirth)}`

const getNameKey = (firstName: string, surname: string) =>
  `${normalizeDuplicateText(firstName)}|${normalizeDuplicateText(surname)}`

export function buildPlayerImportPreview(csvText: string, existingPlayers: ExistingImportPlayer[]): PlayerImportResult {
  const records = parseCsv(csvText)
  if (records.length === 0) return { ok: false, reason: 'Paste CSV data before previewing.' }
  if (records.length === 1) return { ok: false, reason: 'CSV must include at least one player row.' }

  const dataRows = records.slice(1).filter((row) => row.some((cell) => cell.trim()))
  if (dataRows.length === 0) return { ok: false, reason: 'CSV must include at least one player row.' }
  if (dataRows.length > maxPlayerImportRows) {
    return { ok: false, reason: `Import is limited to ${maxPlayerImportRows} player rows for V1.` }
  }

  const headerMap = getHeaderMap(records[0])
  if (
    (headerMap.firstName === undefined || headerMap.surname === undefined) &&
    headerMap.name === undefined
  ) {
    return { ok: false, reason: 'CSV must include firstName and surname columns, or a name column.' }
  }

  const existingActiveSquadNumbers = new Set(
    existingPlayers
      .filter((player) => player.isActive && player.squadNumber !== null)
      .map((player) => player.squadNumber)
  )
  const existingExactKeys = new Set(
    existingPlayers.map((player) => getExactDuplicateKey(player.firstName, player.surname, player.dateOfBirth))
  )
  const existingNameKeys = new Set(
    existingPlayers.map((player) => getNameKey(player.firstName, player.surname))
  )
  const csvExactKeys = new Set<string>()
  const csvNameKeys = new Set<string>()
  const csvSquadNumbers = new Set<number>()

  const rows = dataRows.map((record, index) => {
    const rowNumber = index + 2
    const nameParts = splitFullName(normalizeText(getCell(record, headerMap.name)))
    const firstName = normalizeText(getCell(record, headerMap.firstName)) || nameParts.firstName
    const surname = normalizeText(getCell(record, headerMap.surname)) || nameParts.surname
    const squadNumberText = normalizeText(getCell(record, headerMap.squadNumber))
    const position = normalizeText(getCell(record, headerMap.position))
    const dateOfBirth = normalizeText(getCell(record, headerMap.dateOfBirth))
    const errors: string[] = []
    const warnings: string[] = []
    let squadNumber: number | null = null
    let dateOfBirthValue: Date | null = null

    if (!firstName) errors.push('First name is required.')
    if (!surname) errors.push('Surname is required.')

    if (squadNumberText) {
      const parsedSquadNumber = Number(squadNumberText)
      if (!Number.isInteger(parsedSquadNumber) || parsedSquadNumber < 0) {
        errors.push('Squad number must be a whole number.')
      } else {
        squadNumber = parsedSquadNumber
        if (existingActiveSquadNumbers.has(squadNumber)) {
          errors.push(`Squad number ${squadNumber} is already used by an active player in this team.`)
        }
        if (csvSquadNumbers.has(squadNumber)) {
          errors.push(`Squad number ${squadNumber} is duplicated in this CSV.`)
        }
        csvSquadNumbers.add(squadNumber)
      }
    }

    if (dateOfBirth) {
      dateOfBirthValue = parseDateOfBirth(dateOfBirth)
      if (!dateOfBirthValue) {
        errors.push('Date of birth must be a valid date, preferably YYYY-MM-DD.')
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        warnings.push('Use YYYY-MM-DD for date of birth to avoid spreadsheet date ambiguity.')
      }
    }

    if (position && !isPlayerPosition(position)) {
      errors.push(`Position "${position}" is not recognised.`)
    }

    if (firstName && surname) {
      const exactDuplicateKey = getExactDuplicateKey(firstName, surname, dateOfBirthValue)
      const nameKey = getNameKey(firstName, surname)

      if (dateOfBirthValue && existingExactKeys.has(exactDuplicateKey)) {
        errors.push('A player with this name and date of birth already exists in this team.')
      }
      if (csvExactKeys.has(exactDuplicateKey)) {
        errors.push('This row duplicates another row in this CSV.')
      }
      if (existingNameKeys.has(nameKey)) {
        errors.push('A player with this name already exists in this team.')
      }
      if (csvNameKeys.has(nameKey)) {
        errors.push('Another row in this CSV has the same player name.')
      }

      csvExactKeys.add(exactDuplicateKey)
      csvNameKeys.add(nameKey)
    }

    return {
      rowNumber,
      firstName,
      surname,
      squadNumber,
      position,
      dateOfBirth,
      dateOfBirthValue,
      errors,
      warnings,
    }
  })

  return {
    ok: true,
    rows,
    validCount: rows.filter((row) => row.errors.length === 0).length,
    invalidCount: rows.filter((row) => row.errors.length > 0).length,
    warningCount: rows.filter((row) => row.warnings.length > 0).length,
  }
}

export function getValidPlayerCreateRows(preview: PlayerImportPreview) {
  return preview.rows
    .filter((row) => row.errors.length === 0)
    .map((row) => ({
      firstName: row.firstName,
      surname: row.surname,
      squadNumber: row.squadNumber,
      preferredPosition: row.position || null,
      dateOfBirth: row.dateOfBirthValue,
      isActive: true,
    }))
}

function getHeaderMap(headers: string[]) {
  return headers.reduce<Partial<Record<HeaderKey, number>>>((map, header, index) => {
    const key = headerAliases[normalizeHeader(header)]
    if (key && map[key] === undefined) map[key] = index
    return map
  }, {})
}

function splitFullName(value: string) {
  const parts = value.split(' ').filter(Boolean)

  return {
    firstName: parts[0] ?? '',
    surname: parts.slice(1).join(' '),
  }
}

function getCell(record: string[], index: number | undefined) {
  return index === undefined ? '' : record[index] ?? ''
}

function parseDateOfBirth(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseCsv(csvText: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const nextChar = csvText[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)

  return rows.filter((record) => record.some((value) => value.trim()))
}
