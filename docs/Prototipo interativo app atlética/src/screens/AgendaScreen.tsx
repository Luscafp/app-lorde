import { useState } from 'react'
import { C } from '../theme'
import { fmtCard, parseLocal, todayLocal } from '../utils'
import { eventoNaAgenda, resultadoDoEvento, RESULTADO_LABEL, timeVisivel } from '../domain'
import { Card, Chip, Pill, IcoShield, IcoChev } from '../components/atoms'
import { EmptyState, ListaGate, useEstadoLista } from '../components/shared'
import { EventoCard, MinhaRespostaChip, resultadoColor, useEventoInfo } from '../components/EventoDetalhe'
import { useApp } from '../AppContext'
import type { Evento } from '../types'

function fmtDay(dateKey: string): string {
  const hoje = todayLocal()
  const amanha = parseLocal(hoje); amanha.setDate(amanha.getDate() + 1)
  const d = parseLocal(dateKey)
  if (dateKey === hoje) return 'Hoje'
  if (d.getTime() === amanha.getTime()) return 'Amanhã'
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Placar (UC03) ────────────────────────────────────────────────────────────
function ResultadoCard({ ev, onClick }: { ev: Evento; onClick: () => void }) {
  const { time, advAtletica, mod } = useEventoInfo(ev)
  const r = resultadoDoEvento(ev)
  const col = r ? resultadoColor(r) : C.yellow

  return (
    <Card pad="p-4" onClick={onClick}>
      <div className="flex items-center gap-2 mb-3">
        <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
        <Chip label={r ? RESULTADO_LABEL[r].toUpperCase() : 'RESULTADO PENDENTE'} color={col} />
        <span className="ml-auto f-mono text-[10px]" style={{ color: C.muted }}>{fmtCard(ev.inicio)}</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1 flex-1">
          <IcoShield size={18} color={C.red} />
          <span className="f-sora font-bold text-xs text-center" style={{ color: C.text }}>{time?.nome}</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl"
          style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
          <span className="f-sora font-black text-4xl" style={{ color: r ? col : C.dim, minWidth: 36, textAlign: 'center' }}>{ev.placarTime ?? '–'}</span>
          <span className="f-mono text-xl" style={{ color: C.dim }}>:</span>
          <span className="f-sora font-black text-4xl" style={{ color: r ? C.muted : C.dim, minWidth: 36, textAlign: 'center' }}>{ev.placarAdversario ?? '–'}</span>
        </div>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-lg">{mod?.emoji ?? '⚔️'}</span>
          <span className="f-sora font-bold text-xs text-center leading-tight" style={{ color: C.muted }}>{advAtletica?.nome}</span>
        </div>
      </div>
    </Card>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AgendaScreen() {
  const { eventos, times, modalidades, agendaTab: tab, setAgendaTab: setTab, abrirEvento, demo, setDemo } = useApp()
  const { estado, tentarNovamente } = useEstadoLista(demo, setDemo)
  const [fTipo, setFTipo] = useState<'Todos' | 'Jogos' | 'Treinos'>('Todos')
  const [fMod, setFMod]   = useState('Todas')

  const activeMods = modalidades.filter(m => m.ativa)
  const mods = ['Todas', ...activeMods.map(m => m.nome)]

  // RN19: filtro por modalidade
  function matchesMod(ev: Evento) {
    if (fMod === 'Todas') return true
    const t = times.find(x => x.id === ev.timeId)
    return modalidades.find(m => m.id === t?.modalidadeId)?.nome === fMod
  }
  function matchesTipo(ev: Evento) {
    if (fTipo === 'Todos') return true
    return fTipo === 'Jogos' ? ev.tipo === 'JOGO' : ev.tipo === 'TREINO'
  }

  const visiveis = eventos.filter(e => timeVisivel(times, modalidades, e.timeId))

  const upcoming = visiveis
    .filter(e => eventoNaAgenda(e) && matchesMod(e) && matchesTipo(e))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  // Placar: apenas jogos finalizados, do mais recente ao mais antigo (treinos não entram)
  const resultados = visiveis
    .filter(e => e.tipo === 'JOGO' && e.status === 'Finalizado' && matchesMod(e))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))

  const grouped: [string, Evento[]][] = Object.entries(
    upcoming.reduce((acc, ev) => {
      const key = ev.inicio.slice(0, 10)
      if (!acc[key]) acc[key] = []
      acc[key].push(ev)
      return acc
    }, {} as Record<string, Evento[]>)
  ).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      <div className="px-4 pt-5">
        <h2 className="f-sora font-black text-xl mb-3" style={{ color: C.text }}>Agenda</h2>
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {(['eventos', 'placar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="py-2.5 f-sora font-semibold text-xs transition-all"
              style={{ background: tab === t ? C.red : 'transparent', color: tab === t ? '#fff' : C.muted }}>
              {t === 'eventos' ? '📅 Jogos e treinos' : '🏆 Placar'}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      {tab === 'eventos' && (
        <div className="flex gap-2 px-4 overflow-x-auto pb-1">
          {(['Todos', 'Jogos', 'Treinos'] as const).map(t => (
            <Pill key={t} label={t} active={fTipo === t} color={C.red} onClick={() => setFTipo(t)} />
          ))}
        </div>
      )}
      <div className="flex gap-2 px-4 overflow-x-auto pb-1">
        {mods.map(m => (
          <Pill key={m} label={m} active={fMod === m} color={tab === 'eventos' ? C.blue : C.yellow} onClick={() => setFMod(m)} />
        ))}
      </div>

      <div className="flex flex-col gap-1 px-4">
        <ListaGate estado={estado} onRetry={tentarNovamente}>
          {tab === 'eventos' && (
            grouped.length === 0
              ? <EmptyState icon={<span className="text-4xl opacity-40">📅</span>} message="Nenhum evento para os filtros escolhidos"
                  action={fTipo !== 'Todos' || fMod !== 'Todas' ? 'Limpar filtros' : undefined}
                  onAction={() => { setFTipo('Todos'); setFMod('Todas') }} />
              : grouped.map(([dateKey, evs]) => (
                <div key={dateKey} className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="f-sora font-bold text-xs" style={{ color: C.red }}>{fmtDay(dateKey)}</span>
                    <div className="flex-1 h-px" style={{ background: C.bdr }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {evs.map(ev => (
                      <EventoCard key={ev.id} ev={ev} onClick={() => abrirEvento(ev.id)}
                        right={<div className="flex flex-col items-end gap-1.5 shrink-0"><IcoChev /><MinhaRespostaChip ev={ev} /></div>} />
                    ))}
                  </div>
                </div>
              ))
          )}
          {tab === 'placar' && (
            resultados.length === 0
              ? <EmptyState icon={<span className="text-4xl opacity-40">🏆</span>} message="Nenhum resultado registrado"
                  action={fMod !== 'Todas' ? 'Limpar filtro' : undefined} onAction={() => setFMod('Todas')} />
              : <div className="flex flex-col gap-2">
                  {resultados.map(ev => <ResultadoCard key={ev.id} ev={ev} onClick={() => abrirEvento(ev.id)} />)}
                </div>
          )}
        </ListaGate>
      </div>
    </div>
  )
}
