/** Chaves do MaterialCommunityIcons; ícone novo entra por atualização OTA (issue #15 §14). */
export const ICONES_MODALIDADE = [
  'soccer',
  'basketball',
  'volleyball',
  'handball',
  'table-tennis',
  'tennis',
  'badminton',
  'baseball',
  'rugby',
  'football',
  'hockey-sticks',
  'chess-knight',
  'swim',
  'run',
  'bike',
  'karate',
  'kabaddi',
  'weight-lifter',
  'golf',
  'gamepad-variant',
  'trophy',
] as const

export type IconeModalidade = (typeof ICONES_MODALIDADE)[number]

/** Ícone genérico, também usado para chaves desconhecidas. */
export const ICONE_MODALIDADE_PADRAO: IconeModalidade = 'trophy'

export function ehIconeModalidade(valor: string): valor is IconeModalidade {
  return (ICONES_MODALIDADE as readonly string[]).includes(valor)
}
