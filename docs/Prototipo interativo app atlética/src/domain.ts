// Regras de negócio do protótipo (seção 4 do Documento de Requisitos)
import { ATLETICA } from './theme'
import { nowLocal, todayLocal } from './utils'
import type { Evento, MembroTime, Participacao, Resultado, Time, Modalidade, Solicitacao } from './types'

// RN17: vitória, empate ou derrota calculados pelo placar, do ponto de vista da atlética dona do evento
export function resultadoDoEvento(ev: Evento): Resultado | null {
  if (ev.tipo !== 'JOGO' || ev.placarTime === undefined || ev.placarAdversario === undefined) return null
  if (ev.placarTime > ev.placarAdversario) return 'VITORIA'
  if (ev.placarTime < ev.placarAdversario) return 'DERROTA'
  return 'EMPATE'
}

export const RESULTADO_LABEL: Record<Resultado, string> = { VITORIA: 'Vitória', EMPATE: 'Empate', DERROTA: 'Derrota' }

export const temResultado = (ev: Evento) => resultadoDoEvento(ev) !== null

export const isDaAtletica = (t?: Time) => t?.atleticaId === ATLETICA.id

export function elencoIds(membros: MembroTime[], timeId: string): string[] {
  return membros.filter(m => m.timeId === timeId && !m.saidaEm).map(m => m.usuarioId)
}

export function isMembro(membros: MembroTime[], timeId: string, usuarioId: string): boolean {
  return membros.some(m => m.timeId === timeId && m.usuarioId === usuarioId && !m.saidaEm)
}

export function timesDoUsuario(membros: MembroTime[], usuarioId: string): string[] {
  return membros.filter(m => m.usuarioId === usuarioId && !m.saidaEm).map(m => m.timeId)
}

// Encerra o vínculo ativo de um usuário com um time (ou com todos, se timeId for omitido)
export function encerrarVinculo(membros: MembroTime[], usuarioId: string, timeId?: string): MembroTime[] {
  const agora = nowLocal()
  return membros.map(m => m.usuarioId === usuarioId && !m.saidaEm && (!timeId || m.timeId === timeId) ? { ...m, saidaEm: agora } : m)
}

export function participacaoDe(parts: Participacao[], eventoId: string, usuarioId: string): Participacao | undefined {
  return parts.find(p => p.eventoId === eventoId && p.usuarioId === usuarioId)
}

// Contagem "X vão · Y não vão · Z sem resposta", considerando apenas o elenco atual
export function contagemParticipacao(parts: Participacao[], membros: MembroTime[], ev: Evento) {
  const elenco = elencoIds(membros, ev.timeId)
  const vao = elenco.filter(id => participacaoDe(parts, ev.id, id)?.confirmado === true)
  const naoVao = elenco.filter(id => participacaoDe(parts, ev.id, id)?.confirmado === false)
  return { vao, naoVao, semResposta: elenco.length - vao.length - naoVao.length, total: elenco.length }
}

export function presencaRegistrada(parts: Participacao[], eventoId: string): boolean {
  return parts.some(p => p.eventoId === eventoId && p.presente !== null)
}

export const eventoIniciado = (ev: Evento) => ev.inicio <= nowLocal()

// RN30 / UC15: só membros do elenco, evento Agendado e antes do início
export function podeResponder(ev: Evento, membro: boolean): { ok: boolean; motivo?: string } {
  if (!membro) return { ok: false, motivo: 'Apenas membros do elenco podem confirmar participação' }
  if (ev.status === 'Cancelado') return { ok: false, motivo: 'Evento cancelado' }
  if (ev.status === 'Finalizado') return { ok: false, motivo: 'Evento finalizado' }
  if (ev.status === 'Em andamento' || eventoIniciado(ev)) return { ok: false, motivo: 'O evento já começou' }
  return { ok: true }
}

// RN32 / RF26: estatísticas apenas por presença registrada pela diretoria
export function estatisticas(parts: Participacao[], eventos: Evento[], usuarioId: string) {
  const registradas = parts.filter(p => p.usuarioId === usuarioId && p.presente !== null)
  const presentes = registradas.filter(p => p.presente === true)
  const tipo = (p: Participacao) => eventos.find(e => e.id === p.eventoId)?.tipo
  const jogos = presentes.filter(p => tipo(p) === 'JOGO').length
  const treinos = presentes.filter(p => tipo(p) === 'TREINO').length
  const taxa = registradas.length ? Math.round((presentes.length / registradas.length) * 100) : null
  return { jogos, treinos, taxa }
}

// Times e modalidades inativos não aparecem nas telas do atleta
export function timeVisivel(times: Time[], modalidades: Modalidade[], timeId: string): boolean {
  const t = times.find(x => x.id === timeId)
  const m = modalidades.find(x => x.id === t?.modalidadeId)
  return !!t && t.ativo && !!m && m.ativa
}

// RN18: próximos eventos = agendados ou em andamento; cancelados ficam visíveis até a data prevista
export function eventoNaAgenda(ev: Evento): boolean {
  if (ev.status === 'Agendado' || ev.status === 'Em andamento') return true
  return ev.status === 'Cancelado' && ev.inicio.slice(0, 10) >= todayLocal()
}

export function solicitacaoPendente(solics: Solicitacao[], usuarioId: string, timeId: string) {
  return solics.find(s => s.usuarioId === usuarioId && s.timeId === timeId && s.status === 'PENDENTE')
}

// Próximos treinos agendados de um time (RF21)
export function proximosTreinos(eventos: Evento[], timeId: string): Evento[] {
  const agora = nowLocal()
  return eventos
    .filter(e => e.timeId === timeId && e.tipo === 'TREINO' && e.status === 'Agendado' && e.inicio >= agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}
