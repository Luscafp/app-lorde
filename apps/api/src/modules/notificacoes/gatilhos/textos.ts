import {
  formatarData,
  formatarDataLocal,
  ROTULO_PAPEL,
  type Papel,
  type Resultado,
  type TipoEvento,
} from '@atletica/shared'
import type { StatusAvaliacao } from '../../../infra/eventos/eventos-dominio'
import { formatarDataCurta, type ConteudoNotificacao } from '../envio/mensagens'

export type Texto = Pick<ConteudoNotificacao, 'titulo' | 'corpo'>

export interface EventoExibido {
  tipo: TipoEvento
  inicio: Date
  local: string
  time: string
  adversario: string | null
}

/** Ordenados por início, não vazio. */
export type EventosExibidos = [EventoExibido, ...EventoExibido[]]

export interface SerieExibida {
  time: string
  diasSemana: number[]
  horario: string
  dataFim: Date
  local: string
}

interface Placar {
  resultado: Resultado
  placarTime: number
  placarAdversario: number
}

export type ResultadoExibido = EventoExibido & Placar

type PlacarPendente = { [C in keyof Placar]: Placar[C] | null }

export function comResultado<E extends PlacarPendente>(evento: E): evento is E & Placar {
  return evento.resultado !== null && evento.placarTime !== null && evento.placarAdversario !== null
}

const NOME_TIPO: Readonly<Record<TipoEvento, { singular: string; plural: string }>> = {
  JOGO: { singular: 'jogo', plural: 'jogos' },
  TREINO: { singular: 'treino', plural: 'treinos' },
}

const ROTULO_RESULTADO: Readonly<Record<Resultado, string>> = {
  VITORIA: 'Vitória',
  EMPATE: 'Empate',
  DERROTA: 'Derrota',
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

const juntar = (...partes: (string | null)[]) => partes.filter(Boolean).join(' · ')

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

const diaMes = (instante: Date) => formatarData(instante).slice(0, 5)

const rotuloTipo = ({ tipo }: EventoExibido) => maiuscula(NOME_TIPO[tipo].singular)

function descricao(evento: EventoExibido): string {
  return evento.adversario ? `${rotuloTipo(evento)} vs ${evento.adversario}` : rotuloTipo(evento)
}

/** `"jogos"`, `"treinos"` ou `"eventos"` quando os tipos se misturam. */
function plural([primeiro, ...demais]: EventosExibidos): string {
  return demais.every(({ tipo }) => tipo === primeiro.tipo)
    ? NOME_TIPO[primeiro.tipo].plural
    : 'eventos'
}

/** `[1, 3, 5]` → `"Seg, qua e sex"`. */
function listarDias(diasSemana: readonly number[]): string {
  const nomes = diasSemana.map((dia) => DIAS_SEMANA[dia] ?? String(dia))
  const ultimo = nomes.pop() ?? ''
  return maiuscula(nomes.length > 0 ? `${nomes.join(', ')} e ${ultimo}` : ultimo)
}

function textoDeVarios(eventos: EventosExibidos, verbo: 'alterados' | 'cancelados'): Texto {
  const [primeiro] = eventos
  const tipo = plural(eventos)
  return {
    titulo: `${maiuscula(tipo)} de ${primeiro.time} ${verbo}`,
    corpo: `${eventos.length} ${tipo} a partir de ${diaMes(primeiro.inicio)} foram ${verbo}.`,
  }
}

export function textoEventoCriado(evento: EventoExibido): Texto {
  return {
    titulo: `Novo ${NOME_TIPO[evento.tipo].singular}: ${evento.time}`,
    corpo: juntar(
      evento.adversario && `vs ${evento.adversario}`,
      formatarDataCurta(evento.inicio),
      evento.local,
    ),
  }
}

export function textoSerieCriada(serie: SerieExibida): Texto {
  const ate = formatarDataLocal(serie.dataFim.toISOString().slice(0, 10))
  return {
    titulo: `Novo treino recorrente: ${serie.time}`,
    corpo: `${listarDias(serie.diasSemana)} às ${serie.horario}, até ${ate} · ${serie.local}`,
  }
}

export function textoEventosAlterados(eventos: EventosExibidos): Texto {
  const [primeiro] = eventos
  if (eventos.length > 1) return textoDeVarios(eventos, 'alterados')
  return {
    titulo: `Evento alterado: ${rotuloTipo(primeiro)} de ${primeiro.time}`,
    corpo: `Agora em ${juntar(formatarDataCurta(primeiro.inicio), primeiro.local)}`,
  }
}

export function textoEventosCancelados(eventos: EventosExibidos): Texto {
  const [primeiro] = eventos
  if (eventos.length > 1) return textoDeVarios(eventos, 'cancelados')
  return {
    titulo: 'Evento cancelado',
    corpo: `${descricao(primeiro)} de ${primeiro.time} em ${formatarDataCurta(primeiro.inicio)} foi cancelado.`,
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
