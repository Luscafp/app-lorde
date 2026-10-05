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

/** Rótulo acessível de cada ícone do catálogo. */
export const ROTULO_ICONE_MODALIDADE: Readonly<Record<IconeModalidade, string>> = {
  soccer: 'Futebol',
  basketball: 'Basquete',
  volleyball: 'Vôlei',
  handball: 'Handebol',
  'table-tennis': 'Tênis de mesa',
  tennis: 'Tênis',
  badminton: 'Badminton',
  baseball: 'Beisebol',
  rugby: 'Rugby',
  football: 'Futebol americano',
  'hockey-sticks': 'Hóquei',
  'chess-knight': 'Xadrez',
  swim: 'Natação',
  run: 'Corrida',
  bike: 'Ciclismo',
  karate: 'Artes marciais',
  kabaddi: 'Lutas',
  'weight-lifter': 'Levantamento de peso',
  golf: 'Golfe',
  'gamepad-variant': 'E-sports',
  trophy: 'Genérico',
}

/** Ícone genérico, também usado para chaves desconhecidas. */
export const ICONE_MODALIDADE_PADRAO: IconeModalidade = 'trophy'

export function ehIconeModalidade(valor: string): valor is IconeModalidade {
  return (ICONES_MODALIDADE as readonly string[]).includes(valor)
}
