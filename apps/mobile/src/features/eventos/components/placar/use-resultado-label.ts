import { Resultado } from '@atletica/shared'
import { paleta, useAtletica } from '@/features/atletica'
import { MENSAGEM_RESULTADO_PENDENTE, RESULTADO, siglaOuNome } from '../../rotulos'

export type ResultadoLabel = {
  chip: string
  frase: string
  cor: string
  descrever: (placar: string) => string
}

const COR_PENDENTE = `${paleta.alerta}B3`

const FRASE: Record<Resultado, { comSigla: boolean; conector: string }> = {
  [Resultado.VITORIA]: { comSigla: true, conector: 'por' },
  [Resultado.EMPATE]: { comSigla: false, conector: 'em' },
  [Resultado.DERROTA]: { comSigla: true, conector: 'por' },
}

/** RN17 e RNF20: o resultado vem da API; aqui vira rótulo com a sigla da atlética e cor. */
export function useResultadoLabel(resultado: Resultado | null): ResultadoLabel {
  const sigla = siglaOuNome(useAtletica())
  if (!resultado) {
    return {
      chip: MENSAGEM_RESULTADO_PENDENTE.toUpperCase(),
      frase: MENSAGEM_RESULTADO_PENDENTE,
      cor: COR_PENDENTE,
      descrever: () => MENSAGEM_RESULTADO_PENDENTE,
    }
  }
  const { rotulo, cor } = RESULTADO[resultado]
  const { comSigla, conector } = FRASE[resultado]
  const frase = comSigla ? `${rotulo} da ${sigla}` : rotulo
  return {
    chip: rotulo.toUpperCase(),
    frase,
    cor,
    descrever: (placar) => `${frase} ${conector} ${placar}`,
  }
}
