import { Papel } from '../enums/papel'
import {
  ehAdministrador,
  ehDiretoria,
  ehPresidencia,
  nivelDoPapel,
  podeAgirSobre,
  ROTULO_PAPEL,
  temNivelMinimo,
} from './papeis'

const { ATLETA, DIRETOR, PRESIDENTE, VICE_PRESIDENTE, ADMINISTRADOR } = Papel
const PAPEIS = [ATLETA, DIRETOR, PRESIDENTE, VICE_PRESIDENTE, ADMINISTRADOR] as const

/** Linha = papel avaliado; coluna = papel de referência, na ordem de `PAPEIS`. */
const TEM_NIVEL_MINIMO: Record<Papel, boolean[]> = {
  ATLETA: [true, false, false, false, false],
  DIRETOR: [true, true, false, false, false],
  PRESIDENTE: [true, true, true, true, false],
  VICE_PRESIDENTE: [true, true, true, true, false],
  ADMINISTRADOR: [true, true, true, true, true],
}

const PODE_AGIR_SOBRE: Record<Papel, boolean[]> = {
  ATLETA: [false, false, false, false, false],
  DIRETOR: [true, false, false, false, false],
  PRESIDENTE: [true, true, false, false, false],
  VICE_PRESIDENTE: [true, true, false, false, false],
  ADMINISTRADOR: [true, true, true, true, false],
}

function pares(tabela: Record<Papel, boolean[]>): [Papel, Papel, boolean][] {
  return PAPEIS.flatMap((papel) =>
    PAPEIS.map((outro, i): [Papel, Papel, boolean] => [papel, outro, tabela[papel][i] ?? false]),
  )
}

describe('hierarquia de papéis', () => {
  it('níveis ATLETA=1 < DIRETOR=2 < PRESIDENTE=VICE_PRESIDENTE=3 < ADMINISTRADOR=4', () => {
    expect(PAPEIS.map(nivelDoPapel)).toEqual([1, 2, 3, 3, 4])
  })

  it.each(pares(TEM_NIVEL_MINIMO))('temNivelMinimo(%s, %s) === %s', (papel, minimo, esperado) => {
    expect(temNivelMinimo(papel, minimo)).toBe(esperado)
  })

  it.each(pares(PODE_AGIR_SOBRE))('podeAgirSobre(%s, %s) === %s', (ator, alvo, esperado) => {
    expect(podeAgirSobre(ator, alvo)).toBe(esperado)
  })

  it('atalhos por nível', () => {
    expect(PAPEIS.map(ehDiretoria)).toEqual([false, true, true, true, true])
    expect(PAPEIS.map(ehPresidencia)).toEqual([false, false, true, true, true])
    expect(PAPEIS.map(ehAdministrador)).toEqual([false, false, false, false, true])
  })

  it('rótulos', () => {
    expect(ROTULO_PAPEL).toEqual({
      ATLETA: 'Atleta',
      DIRETOR: 'Diretor(a)',
      PRESIDENTE: 'Presidente',
      VICE_PRESIDENTE: 'Vice-presidente',
      ADMINISTRADOR: 'Administrador(a)',
    })
  })
})
