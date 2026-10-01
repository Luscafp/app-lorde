import { useState } from 'react'
import { C } from '../theme'
import { fmtCard, fmtFull, getMeByRole } from '../utils'
import { Card, Chip, Pill, SH, IcoShield, IcoCheck, IcoPlus, IcoX, IcoBack, IcoChev } from '../components/atoms'
import { EmptyState } from '../components/shared'
import { useApp } from '../AppContext'
import type { Evento } from '../types'

type AgendaTab = 'eventos' | 'placar'

function statusColor(s: string) {
  return ({ Agendado: C.blue, 'Em andamento': C.green, Finalizado: C.muted, Cancelado: '#f43f5e' } as Record<string, string>)[s] ?? C.muted
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  if (day.getTime() === today.getTime()) return 'Hoje'
  if (day.getTime() === tomorrow.getTime()) return 'Amanhã'
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Event detail ──────────────────────────────────────────────────────────
function EventDetail({ ev, onBack, confirmed, onConfirm, onDecline }:
  { ev: Evento; onBack: () => void; confirmed: Set<string>; onConfirm: (id: string) => void; onDecline: (id: string) => void }) {
  const { role, times: TIMES, atleticas: ATLETICAS, modalidades: MODALIDADES } = useApp()
  const me  = getMeByRole(role)
  const tl  = TIMES.find(t => t.id === ev.timeLordeId)
  const ta  = ev.timeAdvId ? TIMES.find(t => t.id === ev.timeAdvId) : null
  const atl = ta ? ATLETICAS.find(a => a.id === ta.atleticaId) : null
  const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)

  const isLive      = ev.status === 'Em andamento'
  const isCancelled = ev.status === 'Cancelado'
  const isFinished  = ev.status === 'Finalizado'
  const isStarted   = isLive || isFinished || isCancelled
  const conf        = confirmed.has(ev.id)

  // Member check: user must belong to the Lorde team for this event
  const inElenco = tl?.atletas?.includes(me.nome) || tl?.capitao === me.nome || me.timeId === ev.timeLordeId

  const confirmCount = ev.confirmados.length + (conf ? 1 : 0)

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      {/* Header */}
      <div className="relative overflow-hidden" style={{ paddingTop: 20, paddingBottom: 24 }}>
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 70% 0%, ${mod?.cor ?? C.red}22, transparent 55%), radial-gradient(ellipse at 20% 100%, ${C.blue}18, transparent 55%)` }} />
        <div className="relative px-4 flex items-start gap-3">
          <button onClick={onBack}
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
            <IcoBack />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <Chip label={ev.tipo} color={ev.tipo === 'JOGO' ? C.red : C.blue} />
              <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
              <Chip label={ev.status} color={statusColor(ev.status)} />
              {isLive && <span className="a-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />}
            </div>
            <h2 className="f-sora font-black text-lg leading-tight" style={{ color: C.text }}>
              {ev.tipo === 'JOGO' ? `${tl?.nome} × ${atl?.nome ?? '—'}` : `Treino — ${tl?.nome}`}
            </h2>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        {/* VS scoreboard or training card */}
        {ev.tipo === 'JOGO' ? (
          <Card pad="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="rounded-2xl flex items-center justify-center"
                  style={{ width: 56, height: 56, background: C.red + '1a', border: `1.5px solid ${C.bdrR}` }}>
                  <IcoShield size={24} color={C.red} />
                </div>
                <span className="f-sora font-bold text-xs text-center leading-tight" style={{ color: C.text }}>
                  {tl?.nome}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="f-sora font-black text-2xl" style={{ color: C.muted }}>VS</span>
                <span className="f-mono text-[11px] font-bold" style={{ color: C.red }}>{fmtCard(ev.inicio)}</span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="rounded-2xl flex items-center justify-center text-2xl"
                  style={{ width: 56, height: 56, background: C.blue + '15', border: `1px solid ${C.bdr}` }}>
                  {mod?.emoji ?? '⚔️'}
                </div>
                <span className="f-sora font-bold text-xs text-center leading-tight" style={{ color: C.muted }}>
                  {atl?.nome ?? '—'}
                </span>
              </div>
            </div>
          </Card>
        ) : (
          <Card pad="p-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{mod?.emoji ?? '🏋️'}</div>
              <div>
                <div className="f-sora font-black text-lg" style={{ color: C.text }}>Treino</div>
                <div className="f-mono text-xs mt-px" style={{ color: C.muted }}>{tl?.nome}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Info grid */}
        <Card pad="p-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Data e hora', value: fmtFull(ev.inicio) },
              { label: 'Local', value: ev.local },
              { label: 'Modalidade', value: `${mod?.emoji} ${mod?.nome}` },
              { label: 'Confirmados', value: `${confirmCount} atletas` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="f-mono text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.dim }}>{label}</div>
                <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{value}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Elenco confirmado */}
        {ev.confirmados.length > 0 && (
          <div>
            <SH title="Elenco confirmado" sub={`${confirmCount} presentes`} />
            <div className="flex flex-col gap-2">
              {ev.confirmados.slice(0, 5).map(nome => (
                <Card key={nome} pad="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-full text-xs font-bold"
                      style={{ width: 32, height: 32, background: C.green + '18', color: C.green }}>
                      <IcoCheck size={14} />
                    </div>
                    <span className="f-sora font-medium text-sm" style={{ color: C.text }}>{nome}</span>
                  </div>
                </Card>
              ))}
              {ev.confirmados.length > 5 && (
                <p className="f-mono text-[10px] text-center" style={{ color: C.muted }}>
                  +{ev.confirmados.length - 5} confirmados
                </p>
              )}
            </div>
          </div>
        )}

        {/* RSVP */}
        {!inElenco ? (
          <div className="px-1 py-3 rounded-2xl text-center"
            style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
            <p className="f-mono text-xs" style={{ color: C.muted }}>
              Apenas membros do elenco podem confirmar presença
            </p>
          </div>
        ) : isStarted ? (
          <div className="px-1 py-3 rounded-2xl text-center"
            style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
            <p className="f-mono text-xs" style={{ color: C.muted }}>
              {isCancelled ? 'Evento cancelado' : isLive ? 'Evento em andamento' : 'Evento encerrado'}
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => onConfirm(ev.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
              style={{
                background: conf ? C.green + '22' : C.green,
                color: conf ? C.green : '#fff',
                border: conf ? `1px solid ${C.green}44` : 'none',
              }}>
              <IcoCheck size={15} color={conf ? C.green : '#fff'} />
              {conf ? 'Confirmado' : 'Vou'}
            </button>
            {conf && (
              <button onClick={() => onDecline(ev.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
                style={{ background: '#f43f5e1a', color: '#f43f5e', border: '1px solid rgba(244,63,94,.3)' }}>
                <IcoX size={15} color="#f43f5e" />
                Não vou
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Events list with day grouping ──────────────────────────────────────────
function EventCard({ ev, onClick }: { ev: Evento; onClick: () => void }) {
  const { times: TIMES, atleticas: ATLETICAS, modalidades: MODALIDADES } = useApp()
  const tl    = TIMES.find(t => t.id === ev.timeLordeId)
  const ta    = ev.timeAdvId ? TIMES.find(t => t.id === ev.timeAdvId) : null
  const atl   = ta ? ATLETICAS.find(a => a.id === ta.atleticaId) : null
  const mod   = MODALIDADES.find(m => m.id === tl?.modalidadeId)
  const isLive = ev.status === 'Em andamento'
  const isCancelled = ev.status === 'Cancelado'
  return (
    <Card onClick={onClick} pad="p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-xl shrink-0 text-lg"
          style={{ width: 44, height: 44, background: (ev.tipo === 'JOGO' ? C.red : C.blue) + '1a', border: `1px solid ${(ev.tipo === 'JOGO' ? C.red : C.blue)}33`, opacity: isCancelled ? .5 : 1 }}>
          {mod?.emoji ?? '🏅'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-px flex-wrap">
            <Chip label={isCancelled ? '✕ CANCELADO' : ev.tipo} color={isCancelled ? '#f43f5e' : ev.tipo === 'JOGO' ? C.red : C.blue} />
            {isLive && <span className="a-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />}
            {ev.recorrente && !isCancelled && <Chip label="↺" color={C.muted} />}
          </div>
          <p className="f-sora font-semibold text-sm truncate" style={{ color: isCancelled ? C.muted : C.text, textDecoration: isCancelled ? 'line-through' : 'none' }}>
            {tl?.nome}{atl ? ` × ${atl.nome}` : ''}
          </p>
          <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>
            {fmtCard(ev.inicio)} · {ev.local}
          </p>
        </div>
        <IcoChev />
      </div>
    </Card>
  )
}

function ResultadoCard({ ev }: { ev: Evento }) {
  const { times: TIMES, atleticas: ATLETICAS, modalidades: MODALIDADES } = useApp()
  const tl  = TIMES.find(t => t.id === ev.timeLordeId)
  const ta  = ev.timeAdvId ? TIMES.find(t => t.id === ev.timeAdvId) : null
  const atl = ta ? ATLETICAS.find(a => a.id === ta.atleticaId) : null
  const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
  const p   = ev.placar
  const win  = p ? p.lorde > p.adv  : false
  const draw = p ? p.lorde === p.adv : false
  const label = win ? 'VITÓRIA' : draw ? 'EMPATE' : 'DERROTA'
  const col   = win ? C.green : draw ? C.yellow : '#f43f5e'

  return (
    <Card pad="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
        {p && <Chip label={label} color={col} />}
        <span className="ml-auto f-mono text-[10px]" style={{ color: C.muted }}>{fmtCard(ev.inicio)}</span>
      </div>
      {p ? (
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <IcoShield size={18} color={C.red} />
            <span className="f-sora font-bold text-xs" style={{ color: C.text }}>{tl?.nome}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl"
            style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
            <span className="f-sora font-black text-4xl" style={{ color: col, minWidth: 36, textAlign: 'center' }}>{p.lorde}</span>
            <span className="f-mono text-xl" style={{ color: C.dim }}>:</span>
            <span className="f-sora font-black text-4xl" style={{ color: C.muted, minWidth: 36, textAlign: 'center' }}>{p.adv}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg">{mod?.emoji ?? '⚔️'}</span>
            <span className="f-sora font-bold text-xs text-center leading-tight" style={{ color: C.muted, maxWidth: 80 }}>{atl?.nome}</span>
          </div>
        </div>
      ) : (
        <div className="py-2 text-center">
          <span className="f-mono text-xs" style={{ color: C.muted }}>
            Treino finalizado · {ev.confirmados.length} presentes
          </span>
        </div>
      )}
    </Card>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AgendaScreen() {
  const { showToast, eventos: EVENTOS, times: TIMES, modalidades: MODALIDADES } = useApp()
  const [tab, setTab]      = useState<AgendaTab>('eventos')
  const [fTipo, setFTipo]  = useState('Todos')
  const [fMod, setFMod]    = useState('Todas')
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set(['e5']))
  const [detail, setDetail] = useState<Evento | null>(null)

  const tipos = ['Todos', 'Jogos', 'Treinos']
  const activeMods = MODALIDADES.filter(m => m.ativa)
  const activeTimes = new Set(TIMES.filter(t => t.ativo !== false && activeMods.some(m => m.id === t.modalidadeId)).map(t => t.id))
  const mods  = ['Todas', ...activeMods.map(m => m.nome)]

  function toggleConf(id: string, isConf: boolean) {
    setConfirmed(prev => {
      const next = new Set(prev)
      if (isConf) { next.delete(id); showToast('Presença cancelada', 'error') }
      else         { next.add(id);   showToast('Presença confirmada!', 'success') }
      return next
    })
  }

  function matchesMod(ev: Evento) {
    if (fMod === 'Todas') return true
    const tl  = TIMES.find(t => t.id === ev.timeLordeId)
    const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
    return mod?.nome === fMod
  }

  function matchesTipo(ev: Evento) {
    if (fTipo === 'Todos') return true
    return fTipo === 'Jogos' ? ev.tipo === 'JOGO' : ev.tipo === 'TREINO'
  }

  const upcoming = EVENTOS
    .filter(e => activeTimes.has(e.timeLordeId) && e.status !== 'Finalizado' && matchesMod(e) && matchesTipo(e))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  const resultados = EVENTOS
    .filter(e => activeTimes.has(e.timeLordeId) && e.status === 'Finalizado' && (e.tipo === 'JOGO') && matchesMod(e))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))

  // Group upcoming by day
  const grouped: [string, Evento[]][] = Object.entries(
    upcoming.reduce((acc, ev) => {
      const key = ev.inicio.slice(0, 10)
      if (!acc[key]) acc[key] = []
      acc[key].push(ev)
      return acc
    }, {} as Record<string, Evento[]>)
  ).sort(([a], [b]) => a.localeCompare(b))

  if (detail) {
    return (
      <EventDetail
        ev={detail}
        onBack={() => setDetail(null)}
        confirmed={confirmed}
        onConfirm={id => toggleConf(id, confirmed.has(id))}
        onDecline={id => toggleConf(id, confirmed.has(id))}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      <div className="px-4 pt-5">
        <h2 className="f-sora font-black text-xl mb-3" style={{ color: C.text }}>Agenda</h2>
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {(['eventos', 'placar'] as AgendaTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="py-2.5 f-sora font-semibold text-xs transition-all capitalize"
              style={{ background: tab === t ? C.red : 'transparent', color: tab === t ? '#fff' : C.muted }}>
              {t === 'eventos' ? '📅 Eventos' : '⚡ Placar'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      {tab === 'eventos' && (
        <>
          <div className="flex gap-2 px-4 overflow-x-auto pb-1">
            {tipos.map(t => (
              <Pill key={t} label={t} active={fTipo === t} color={C.red} onClick={() => setFTipo(t)} />
            ))}
          </div>
          <div className="flex gap-2 px-4 overflow-x-auto pb-1">
            {mods.map(m => (
              <Pill key={m} label={m} active={fMod === m} color={C.blue} onClick={() => setFMod(m)} />
            ))}
          </div>
        </>
      )}
      {tab === 'placar' && (
        <div className="flex gap-2 px-4 overflow-x-auto pb-1">
          {['Todas', ...activeMods.map(m => m.nome)].map(m => (
            <Pill key={m} label={m} active={fMod === m} color={C.yellow} onClick={() => setFMod(m)} />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col gap-1 px-4">
        {tab === 'eventos' && (
          grouped.length === 0
            ? <EmptyState icon={<span className="text-4xl opacity-40">📅</span>} message="Nenhum evento encontrado" action="Limpar filtros" onAction={() => { setFTipo('Todos'); setFMod('Todas') }} />
            : grouped.map(([dateKey, evs]) => (
              <div key={dateKey} className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="f-sora font-bold text-xs" style={{ color: C.red }}>{fmtDay(`${dateKey}T12:00:00`)}</span>
                  <div className="flex-1 h-px" style={{ background: C.bdr }} />
                </div>
                <div className="flex flex-col gap-2">
                  {evs.map(ev => <EventCard key={ev.id} ev={ev} onClick={() => setDetail(ev)} />)}
                </div>
              </div>
            ))
        )}
        {tab === 'placar' && (
          resultados.length === 0
            ? <EmptyState icon={<span className="text-4xl opacity-40">🏆</span>} message="Nenhum resultado ainda" />
            : resultados.map(ev => <ResultadoCard key={ev.id} ev={ev} />)
        )}
      </div>
    </div>
  )
}
