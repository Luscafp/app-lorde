import { Resultado, StatusEvento, TipoEvento, type EventoResumoDto } from '@atletica/shared'
import { paleta } from '@/features/atletica'

type Rotulo = { rotulo: string; cor: string }

export const ROTULO_TIPO: Record<TipoEvento, string> = {
  [TipoEvento.JOGO]: 'JOGO',
  [TipoEvento.TREINO]: 'TREINO',
}

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

type AtleticaAdversaria = NonNullable<EventoResumoDto['timeAdversario']>['atletica']

export const siglaOuNome = ({ sigla, nome }: AtleticaAdversaria) => sigla ?? nome

export function tituloEvento({ time, timeAdversario }: EventoResumoDto): string {
  return timeAdversario ? `${time.nome} × ${timeAdversario.atletica.nome}` : `Treino — ${time.nome}`
}
