type CsvValue = string | number | boolean | null | undefined

export const escapeCsvValue = (value: CsvValue) => {
  if (value === null || value === undefined) return ''

  const stringValue = String(value)
  const escapedValue = stringValue.replaceAll('"', '""')

  return /[",\n\r]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue
}

export const buildCsv = (headers: string[], rows: CsvValue[][]) =>
  [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\n')

export const downloadCsv = (filename: string, csvContent: string) => {
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const slugifyFilename = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'export'
}
