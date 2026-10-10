import {
  formatarDataLocal,
  ROTULO_PAPEL,
  type Papel,
  type Resultado,
  type TipoEvento,
} from '@atletica/shared'
import type { StatusAvaliacao } from '../../../infra/eventos/eventos-dominio'
import { formatarDataCurta } from '../envio/mensagens'

export interface Texto {
  titulo: string
  corpo: string
}

export interface EventoExibido {
  tipo: TipoEvento
  inicio: Date
  local: string
  time: string
  adversario: string | null
}

export interface SerieExibida {
  time: string
  diasSemana: number[]
  horario: string
  dataFim: Date
  local: string
}

export interface ResultadoExibido extends EventoExibido {
  resultado: Resultado
  placarTime: number
  placarAdversario: number
}

const ROTULO_TIPO: Readonly<Record<TipoEvento, string>> = { JOGO: 'Jogo', TREINO: 'Treino' }

const ROTULO_RESULTADO: Readonly<Record<Resultado, string>> = {
  VITORIA: 'Vitória',
  EMPATE: 'Empate',
  DERROTA: 'Derrota',
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

const juntar = (...partes: (string | null)[]) => partes.filter(Boolean).join(' · ')

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

const diaMes = (instante: Date) => formatarDataCurta(instante).slice(0, 5)

function descricao({ tipo, adversario }: EventoExibido): string {
  return tipo === 'JOGO' && adversario ? `Jogo vs ${adversario}` : ROTULO_TIPO[tipo]
}

/** `"jogos"`, `"treinos"` ou `"eventos"` quando os tipos se misturam. */
function plural(eventos: readonly EventoExibido[]): string {
  const tipos = new Set(eventos.map(({ tipo }) => tipo))
  if (tipos.size > 1) return 'eventos'
  return tipos.has('JOGO') ? 'jogos' : 'treinos'
}

/** `[1, 3, 5]` → `"Seg, qua e sex"`. */
function listarDias(diasSemana: readonly number[]): string {
  const nomes = diasSemana.map((dia) => DIAS_SEMANA[dia] ?? String(dia))
  const ultimo = nomes.pop() ?? ''
  return maiuscula(nomes.length > 0 ? `${nomes.join(', ')} e ${ultimo}` : ultimo)
}

export function textoEventoCriado(evento: EventoExibido): Texto {
  const quando = formatarDataCurta(evento.inicio)
  if (evento.tipo === 'JOGO') {
    return {
      titulo: `Novo jogo: ${evento.time}`,
      corpo: juntar(evento.adversario && `vs ${evento.adversario}`, quando, evento.local),
    }
  }
  return { titulo: `Novo treino: ${evento.time}`, corpo: juntar(quando, evento.local) }
}

export function textoSerieCriada(serie: SerieExibida): Texto {
  const ate = formatarDataLocal(serie.dataFim.toISOString().slice(0, 10))
  return {
    titulo: `Novo treino recorrente: ${serie.time}`,
    corpo: `${listarDias(serie.diasSemana)} às ${serie.horario}, até ${ate} · ${serie.local}`,
  }
}

/** `eventos` em ordem de início, não vazio. */
export function textoEventosAlterados([primeiro, ...demais]: [
  EventoExibido,
  ...EventoExibido[],
]): Texto {
  if (demais.length === 0) {
    return {
      titulo: `Evento alterado: ${ROTULO_TIPO[primeiro.tipo]} de ${primeiro.time}`,
      corpo: `Agora em ${juntar(formatarDataCurta(primeiro.inicio), primeiro.local)}`,
    }
  }
  const tipo = plural([primeiro, ...demais])
  return {
    titulo: `${maiuscula(tipo)} de ${primeiro.time} alterados`,
    corpo: `${demais.length + 1} ${tipo} a partir de ${diaMes(primeiro.inicio)} foram alterados.`,
  }
}

/** `eventos` em ordem de início, não vazio. */
export function textoEventosCancelados([primeiro, ...demais]: [
  EventoExibido,
  ...EventoExibido[],
]): Texto {
  if (demais.length === 0) {
    const quando = formatarDataCurta(primeiro.inicio)
    return {
      titulo: 'Evento cancelado',
      corpo: `${descricao(primeiro)} de ${primeiro.time} em ${quando} foi cancelado.`,
    }
  }
  const tipo = plural([primeiro, ...demais])
  return {
    titulo: `${maiuscula(tipo)} de ${primeiro.time} cancelados`,
    corpo: `${demais.length + 1} ${tipo} a partir de ${diaMes(primeiro.inicio)} foram cancelados.`,
  }
}

export function textoResultado(sigla: string, jogo: ResultadoExibido): Texto {
  const adversario = jogo.adversario ? ` ${jogo.adversario}` : ''
  return {
    titulo: `${ROTULO_RESULTADO[jogo.resultado]} da ${sigla}`,
    corpo: `${jogo.time} ${jogo.placarTime} x ${jogo.placarAdversario}${adversario}`,
  }
}

export function textoNoticia(sigla: string, tituloNoticia: string): Texto {
  return { titulo: `${sigla} publicou uma notícia`, corpo: tituloNoticia }
}

export function textoNovaSolicitacao(solicitante: string, time: string): Texto {
  return { titulo: 'Nova solicitação de entrada', corpo: `${solicitante} quer entrar em ${time}.` }
}

export function textoSolicitacaoAvaliada(status: StatusAvaliacao, time: string): Texto {
  return status === 'APROVADA'
    ? { titulo: 'Solicitação aprovada', corpo: `Você agora faz parte de ${time}.` }
    : { titulo: 'Solicitação não aceita', corpo: `Sua solicitação para ${time} não foi aceita.` }
}

export function textoCargo(papelNovo: Papel): Texto {
  return { titulo: 'Seu cargo foi alterado', corpo: `Agora você é ${ROTULO_PAPEL[papelNovo]}.` }
}
