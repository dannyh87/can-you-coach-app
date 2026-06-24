const synonymMap: Record<string, string> = {
  completed: 'complete',
  successful: 'complete',
  failed: 'incomplete',
  unsuccessful: 'incomplete',
  accurate: 'target',
  dribble: '1v1',
  dribbling: '1v1',
}

export function normalizeEventDefinitionName(name: string) {
  return name
    .toLowerCase()
    .replace(/one\s+v\s+one/g, '1v1')
    .replace(/1\s*v\s*1/g, '1v1')
    .replace(/on\s+target/g, 'target')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => synonymMap[token] ?? token)
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
    .sort()
    .join(' ')
}

export function createEventDefinitionSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'event'
}
