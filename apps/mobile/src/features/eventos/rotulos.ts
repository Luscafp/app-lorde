import { Resultado, StatusEvento, TipoEvento, type EventoResumoDto } from '@atletica/shared'
import type { Opcao } from '@/components/ui'
import { paleta } from '@/features/atletica'

type Rotulo = { rotulo: string; cor: string }

export const ROTULO_TIPO: Record<TipoEvento, string> = {
  [TipoEvento.JOGO]: 'JOGO',
  [TipoEvento.TREINO]: 'TREINO',
}

export const OPCOES_TIPO: readonly Opcao<TipoEvento>[] = [
  { valor: undefined, rotulo: 'Todos' },
  { valor: TipoEvento.JOGO, rotulo: 'Jogos' },
  { valor: TipoEvento.TREINO, rotulo: 'Treinos' },
]

export const OPCOES_STATUS: readonly Opcao<StatusEvento>[] = [
  { valor: undefined, rotulo: 'Todos os status' },
  { valor: StatusEvento.AGENDADO, rotulo: 'Agendados' },
  { valor: StatusEvento.EM_ANDAMENTO, rotulo: 'Em andamento' },
  { valor: StatusEvento.FINALIZADO, rotulo: 'Finalizados' },
  { valor: StatusEvento.CANCELADO, rotulo: 'Cancelados' },
]

/** RN14: rótulo e cor; a cor nunca é a única pista. */
export const STATUS: Record<StatusEvento, Rotulo> = {
  [StatusEvento.AGENDADO]: { rotulo: 'Agendado', cor: paleta['texto-suave'] },
  [StatusEvento.EM_ANDAMENTO]: { rotulo: 'Em andamento', cor: paleta.alerta },
  [StatusEvento.FINALIZADO]: { rotulo: 'Finalizado', cor: paleta.sucesso },
  [StatusEvento.CANCELADO]: { rotulo: 'Cancelado', cor: paleta.erro },
}

export const RESULTADO: Record<Resultado, Rotulo> = {
  [Resultado.VITORIA]: { rotulo: 'Vitória', cor: paleta.sucesso },
  [Resultado.EMPATE]: { rotulo: 'Empate', cor: paleta.alerta },
  [Resultado.DERROTA]: { rotulo: 'Derrota', cor: paleta.erro },
}

export type AtleticaAdversaria = NonNullable<EventoResumoDto['timeAdversario']>['atletica']

export const siglaOuNome = ({ sigla, nome }: AtleticaAdversaria) => sigla ?? nome
