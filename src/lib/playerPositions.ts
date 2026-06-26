export const playerPositions = [
  'Goalkeeper',
  'Defender',
  'Right Back',
  'Centre Back',
  'Left Back',
  'Midfielder',
  'Defensive Midfielder',
  'Central Midfielder',
  'Attacking Midfielder',
  'Forward',
  'Right Wing',
  'Left Wing',
  'Striker',
] as const

export function isPlayerPosition(value: string) {
  return playerPositions.includes(value as (typeof playerPositions)[number])
}
