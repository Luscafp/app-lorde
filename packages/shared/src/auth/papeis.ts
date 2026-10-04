import { Papel } from '../enums/papel'

export type NivelPapel = 1 | 2 | 3 | 4

/** Hierarquia RN05 (convenções §5): Presidente e Vice-presidente têm o mesmo nível. */
export const NIVEL_PAPEL: Readonly<Record<Papel, NivelPapel>> = {
  ATLETA: 1,
  DIRETOR: 2,
  PRESIDENTE: 3,
  VICE_PRESIDENTE: 3,
  ADMINISTRADOR: 4,
}

export const ROTULO_PAPEL: Readonly<Record<Papel, string>> = {
  ATLETA: 'Atleta',
  DIRETOR: 'Diretor(a)',
  PRESIDENTE: 'Presidente',
  VICE_PRESIDENTE: 'Vice-presidente',
  ADMINISTRADOR: 'Administrador(a)',
}

export function nivelDoPapel(papel: Papel): NivelPapel {
  return NIVEL_PAPEL[papel]
}

export function temNivelMinimo(papel: Papel, minimo: Papel): boolean {
  return nivelDoPapel(papel) >= nivelDoPapel(minimo)
}

/** Nível estritamente maior: ninguém age sobre o próprio nível (UC23 A1). */
export function podeAgirSobre(papelAtor: Papel, papelAlvo: Papel): boolean {
  return nivelDoPapel(papelAtor) > nivelDoPapel(papelAlvo)
}

export function ehDiretoria(papel: Papel): boolean {
  return temNivelMinimo(papel, Papel.DIRETOR)
}

export function ehPresidencia(papel: Papel): boolean {
  return temNivelMinimo(papel, Papel.PRESIDENTE)
}

export function ehAdministrador(papel: Papel): boolean {
  return papel === Papel.ADMINISTRADOR
}
