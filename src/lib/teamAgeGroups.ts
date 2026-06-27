export const teamAgeGroups = [
  'U6',
  'U7',
  'U8',
  'U9',
  'U10',
  'U11',
  'U12',
  'U13',
  'U14',
  'U15',
  'U16',
  'U17',
  'U18',
  'U19',
  'U21',
  'U23',
  'Open Age',
  'Veterans',
] as const

export function isTeamAgeGroup(value: string) {
  return teamAgeGroups.includes(value as (typeof teamAgeGroups)[number])
}
