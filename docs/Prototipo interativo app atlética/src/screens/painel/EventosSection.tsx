import { useState } from 'react'
import { C, ATLETICA } from '../../theme'
import { fmtCard, fmtFull, canDelete, initials, parseLocal } from '../../utils'
import {
  resultadoDoEvento, RESULTADO_LABEL, elencoIds, participacaoDe, presencaRegistrada, contagemParticipacao,
} from '../../domain'
import { Card, Chip, Pill, Av, IcoBack, IcoPlus, IcoCheck, IcoX, IcoBin, IcoEdit, IcoAlert, IcoShield, IcoChev } from '../../components/atoms'
import { EmptyState, Field, Sheet } from '../../components/shared'
import { statusColor, resultadoColor, useEventoInfo } from '../../components/EventoDetalhe'
import { useApp } from '../../AppContext'
import type { Evento, EventoStatus, EventoTipo } from '../../types'

type EView = 'list' | 'form' | 'detail' | 'resultado' | 'presenca'
type Escopo = 'este' | 'seguintes'

const STATUS_ORDER: EventoStatus[] = ['Agendado', 'Em andamento', 'Finalizado', 'Cancelado']
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const p2 = (n: number) => String(n).padStart(2, '0')

// Gera as datas da série recorrente (RN13)
function ocorrencias(dataInicio: string, hora: string, dias: number[], dataFim: string): string[] {
  if (!dataInicio || !dataFim || !dias.length) return []
  const out: string[] = []
  const cur = parseLocal(dataInicio)
  const fim = parseLocal(dataFim)
  while (cur <= fim && out.length < 200) {
    if (dias.includes(cur.getDay())) out.push(`${cur.getFullYear()}-${p2(cur.getMonth() + 1)}-${p2(cur.getDate())}T${hora}:00`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

// ─── Escolha "Somente este / Este e os seguintes" (RN13) ──────────────────────
function EscopoSheet({ titulo, onPick, onClose }: { titulo: string; onPick: (e: Escopo) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h3 className="f-sora font-black text-base mb-1" style={{ color: C.text }}>{titulo}</h3>
      <p className="f-mono text-[10px] mb-4" style={{ color: C.muted }}>Este treino faz parte de uma série recorrente. Aplicar a:</p>
      {([['este', 'Somente este treino'], ['seguintes', 'Este e os seguintes']] as const).map(([v, label]) => (
        <button key={v} onClick={() => onPick(v)}
          className="w-full px-4 py-3 rounded-xl mb-2 text-left f-sora font-semibold text-sm"
          style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text }}>{label}</button>
      ))}
      <button onClick={onClose} className="w-full py-3 f-mono text-sm" style={{ color: C.muted }}>Voltar</button>
    </Sheet>
  )
}

// ─── Cadastro de adversário sem sair da tela (UC16 A4) ────────────────────────
function NewAdvSheet({ modalidadeNome, onAdd, onClose }:
  { modalidadeNome: string; onAdd: (atletica: string, curso: string, time: string) => void; onClose: () => void }) {
  const [atl, setAtl] = useState(''); const [curso, setCurso] = useState(''); const [time, setTime] = useState('')
  const ok = atl.trim() && curso.trim() && time.trim()
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Cadastrar adversário</h3>
        <button onClick={onClose} style={{ color: C.muted }}><IcoX size={18} /></button>
      </div>
      <p className="f-mono text-[10px] mb-4" style={{ color: C.muted }}>
        A atlética é cadastrada sem uso do aplicativo e o time fica na modalidade {modalidadeNome}.
      </p>
      <div className="flex flex-col gap-3 mb-5">
        <Field label="Nome da atlética" value={atl} onChange={setAtl} />
        <Field label="Curso" value={curso} onChange={setCurso} />
        <Field label="Nome do time" value={time} onChange={setTime} placeholder="Ex.: Futsal Masculino" />
      </div>
      <button onClick={() => { if (ok) { onAdd(atl.trim(), curso.trim(), time.trim()); onClose() } }} disabled={!ok}
        className="w-full py-3 rounded-2xl f-sora font-bold text-sm"
        style={{ background: ok ? C.blue : C.dim, color: '#fff' }}>
        Cadastrar
      </button>
    </Sheet>
  )
}

type FormData = {
  tipo: EventoTipo; timeId: string; timeAdversarioId?: string; data: string; hora: string; local: string
  recorrente: boolean; dias: number[]; dataFim: string
}

// ─── Formulário de evento (UC16) ──────────────────────────────────────────────
function EventoForm({ initial, onSave, onBack }:
  { initial?: Evento; onSave: (f: FormData) => void; onBack: () => void }) {
  const { times, modalidades, atleticas, setTimes, setAtleticas, audit } = useApp()
  const [tipo, setTipo]         = useState<EventoTipo>(initial?.tipo ?? 'JOGO')
  const [timeId, setTimeId]     = useState(initial?.timeId ?? '')
  const [advId, setAdvId]       = useState(initial?.timeAdversarioId ?? '')
  const [data, setData]         = useState(initial?.inicio.slice(0, 10) ?? '')
  const [hora, setHora]         = useState(initial?.inicio.slice(11, 16) ?? '18:00')
  const [local, setLocal]       = useState(initial?.local ?? '')
  const [recorrente, setRecorrente] = useState(false)
  const [dias, setDias]         = useState<number[]>([])
  const [dataFim, setDataFim]   = useState('')
  const [showNewAdv, setShowNewAdv] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const nossosTimes = times.filter(t => t.atleticaId === ATLETICA.id && t.ativo)
  const selTime = times.find(t => t.id === timeId)
  const selMod = modalidades.find(m => m.id === selTime?.modalidadeId)
  // RN11: adversário da mesma modalidade
  const advTimes = times.filter(t => t.atleticaId !== ATLETICA.id && t.ativo && t.modalidadeId === selTime?.modalidadeId)
  const datas = tipo === 'TREINO' && recorrente && !initial ? ocorrencias(data, hora, dias, dataFim) : []

  function save() {
    const e: Record<string, string> = {}
    if (!timeId) e.timeId = `Selecione o time da ${ATLETICA.sigla}`
    if (tipo === 'JOGO' && !advId) e.advId = 'Jogo exige time adversário'
    if (!data) e.data = 'Informe a data'
    if (!hora) e.hora = 'Informe o horário'
    if (!local.trim()) e.local = 'Informe o local'
    if (tipo === 'TREINO' && recorrente && !initial) {
      if (!dias.length) e.dias = 'Selecione ao menos um dia da semana'
      if (!dataFim || dataFim <= data) e.dataFim = '"Repetir até" deve ser posterior à data de início'
      else {
        const max = parseLocal(data); max.setMonth(max.getMonth() + 6)
        if (parseLocal(dataFim) > max) e.dataFim = 'A série pode ter no máximo 6 meses'
        else if (!datas.length) e.dias = 'Nenhuma data no período para os dias escolhidos'
      }
    }
    setErrors(e)
    if (Object.keys(e).length) return
    onSave({ tipo, timeId, timeAdversarioId: tipo === 'JOGO' ? advId : undefined, data, hora, local: local.trim(), recorrente, dias, dataFim })
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>
          {initial ? 'Editar evento' : 'Novo evento'}
        </h3>
      </div>

      {/* Tipo: Jogo ou Treino (RN10) */}
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.bdr}`, background: C.card }}>
          {(['JOGO', 'TREINO'] as const).map(t => (
            <button key={t} onClick={() => !initial && setTipo(t)} disabled={!!initial}
              className="py-2.5 f-sora font-semibold text-sm"
              style={{ background: tipo === t ? C.red : 'transparent', color: tipo === t ? '#fff' : C.muted, opacity: initial && tipo !== t ? .4 : 1 }}>
              {t === 'JOGO' ? '⚔️ Jogo' : '🏋️ Treino'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4">
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>
            Time da {ATLETICA.sigla} <span style={{ color: C.red }}>*</span>
          </label>
          <div className="flex flex-col gap-1.5">
            {nossosTimes.map(t => {
              const mod = modalidades.find(m => m.id === t.modalidadeId)
              return (
                <button key={t.id} onClick={() => { setTimeId(t.id); if (t.modalidadeId !== selTime?.modalidadeId) setAdvId('') }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                  style={{ background: timeId === t.id ? C.red + '18' : C.card2, border: `1px solid ${timeId === t.id ? C.red + '55' : C.bdr}` }}>
                  <span className="text-lg">{mod?.emoji}</span>
                  <div className="flex-1">
                    <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{t.nome}</div>
                    <div className="f-mono text-[9px]" style={{ color: C.muted }}>{mod?.nome}</div>
                  </div>
                  {timeId === t.id && <IcoCheck size={14} color={C.red} />}
                </button>
              )
            })}
          </div>
          {errors.timeId && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{errors.timeId}</p>}
        </div>

        {tipo === 'JOGO' && (
          <div>
            <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>
              Time adversário <span style={{ color: C.red }}>*</span>
            </label>
            {selTime ? (
              <>
                {advTimes.length === 0
                  ? <p className="f-mono text-xs mb-2" style={{ color: C.dim }}>Nenhum adversário de {selMod?.nome} cadastrado.</p>
                  : (
                    <div className="flex flex-col gap-1.5 mb-2">
                      {advTimes.map(t => (
                        <button key={t.id} onClick={() => setAdvId(t.id)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                          style={{ background: advId === t.id ? C.blue + '18' : C.card2, border: `1px solid ${advId === t.id ? C.bdrB : C.bdr}` }}>
                          <div className="flex-1">
                            <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{atleticas.find(a => a.id === t.atleticaId)?.nome}</div>
                            <div className="f-mono text-[9px]" style={{ color: C.muted }}>{t.nome}</div>
                          </div>
                          {advId === t.id && <IcoCheck size={14} color={C.blueL} />}
                        </button>
                      ))}
                    </div>
                  )}
                <button onClick={() => setShowNewAdv(true)}
                  className="flex items-center gap-1.5 f-mono text-[10px]" style={{ color: C.blueL }}>
                  <IcoPlus size={12} color={C.blueL} /> Cadastrar atlética/time adversário
                </button>
              </>
            ) : (
              <p className="f-mono text-xs" style={{ color: C.dim }}>Selecione primeiro o time da {ATLETICA.sigla}</p>
            )}
            {errors.advId && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{errors.advId}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={tipo === 'TREINO' && recorrente ? 'Data de início' : 'Data'} value={data} onChange={setData} type="date" required error={errors.data} />
          <Field label="Horário" value={hora} onChange={setHora} type="time" required error={errors.hora} />
        </div>
        <Field label="Local" value={local} onChange={setLocal} required error={errors.local} placeholder="Ex.: Ginásio do CEB" />

        {/* Treino recorrente (RF30 / RN13) — só na criação; por padrão o treino é avulso */}
        {tipo === 'TREINO' && !initial && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="f-sora font-medium text-sm" style={{ color: C.text }}>Treino recorrente</span>
                <p className="f-mono text-[9px]" style={{ color: C.muted }}>Repete nos dias escolhidos até a data final (máx. 6 meses)</p>
              </div>
              <button onClick={() => setRecorrente(v => !v)}
                className="rounded-full transition-all shrink-0" style={{ width: 44, height: 24, background: recorrente ? C.green : C.dim, padding: 3 }}>
                <div className="rounded-full transition-all" style={{ width: 18, height: 18, background: '#fff', transform: `translateX(${recorrente ? 20 : 0}px)` }} />
              </button>
            </div>
            {recorrente && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>Dias da semana</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEKDAYS.map((d, i) => (
                      <button key={i} onClick={() => setDias(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                        className="px-2.5 py-1 rounded-lg f-mono text-[10px] font-semibold"
                        style={{ background: dias.includes(i) ? C.blue + '22' : C.card2, color: dias.includes(i) ? C.blueL : C.muted, border: `1px solid ${dias.includes(i) ? C.bdrB : C.bdr}` }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {errors.dias && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{errors.dias}</p>}
                </div>
                <Field label="Repetir até" value={dataFim} onChange={setDataFim} type="date" error={errors.dataFim} />
                {datas.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.blue + '15', border: `1px solid ${C.bdrB}` }}>
                    <IcoCheck size={13} color={C.blueL} />
                    <span className="f-mono text-xs" style={{ color: C.blueL }}>Serão criados {datas.length} treinos</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button onClick={save}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          {initial ? 'Salvar alterações' : 'Criar evento'}
        </button>
      </div>

      {showNewAdv && selTime && (
        <NewAdvSheet
          modalidadeNome={selMod?.nome ?? ''}
          onAdd={(atl, curso, nomeTime) => {
            const stamp = Date.now()
            const atlId = `atl-${stamp}`
            const newId = `adv-${stamp}`
            setAtleticas(p => [...p, { id: atlId, nome: atl, curso, usaAplicativo: false }])
            setTimes(p => [...p, { id: newId, nome: nomeTime, atleticaId: atlId, modalidadeId: selTime.modalidadeId, ativo: true }])
            setAdvId(newId)
            audit('Times e elencos', 'Cadastrou atlética adversária', `${atl} · ${nomeTime}`)
          }}
          onClose={() => setShowNewAdv(false)}
        />
      )}
    </div>
  )
}

function ScorePad({ val, set }: { val: number; set: (f: (v: number) => number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={() => set(v => v + 1)}
        className="flex items-center justify-center rounded-2xl text-xl font-bold"
        style={{ width: 44, height: 44, background: C.red + '22', color: C.red, border: `1px solid ${C.bdrR}` }}>+</button>
      <div className="f-sora font-black text-5xl" style={{ color: C.text, minWidth: 60, textAlign: 'center' }}>{val}</div>
      <button onClick={() => set(v => Math.max(0, v - 1))}
        className="flex items-center justify-center rounded-2xl text-xl font-bold"
        style={{ width: 44, height: 44, background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>−</button>
    </div>
  )
}

// ─── Registrar resultado (UC17) ───────────────────────────────────────────────
function ResultadoForm({ ev, onBack }: { ev: Evento; onBack: () => void }) {
  const { setEventos, showToast, audit, online } = useApp()
  const { time, advAtletica, mod } = useEventoInfo(ev)
  const [nosso, setNosso] = useState(ev.placarTime ?? 0)
  const [adv, setAdv]     = useState(ev.placarAdversario ?? 0)
  const corrigindo = resultadoDoEvento(ev) !== null
  const r = resultadoDoEvento({ ...ev, placarTime: nosso, placarAdversario: adv })!

  function finalizar() {
    if (!online()) return
    setEventos(p => p.map(e => e.id === ev.id ? { ...e, status: 'Finalizado' } : e))
    audit('Eventos', 'Alterou status para Finalizado', `${time?.nome} × ${advAtletica?.nome}`)
    showToast('Jogo marcado como finalizado', 'success')
  }

  function save() {
    if (!online()) return
    setEventos(p => p.map(e => e.id === ev.id ? { ...e, placarTime: nosso, placarAdversario: adv } : e))
    audit('Resultados', corrigindo ? 'Corrigiu resultado' : 'Registrou resultado',
      `${time?.nome} ${nosso} × ${adv} ${advAtletica?.nome}${corrigindo ? ` (antes ${ev.placarTime} × ${ev.placarAdversario})` : ''}`)
    showToast(corrigindo ? 'Resultado corrigido — registrado na auditoria' : 'Resultado registrado — usuários notificados', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-5 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{corrigindo ? 'Corrigir resultado' : 'Registrar resultado'}</h3>
      </div>

      {/* RN15 / UC17 A1 */}
      {ev.status !== 'Finalizado' ? (
        <div className="mx-4 flex items-start gap-2 px-3 py-3 rounded-xl" style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <IcoAlert size={14} color={C.yellow} />
          <div className="flex-1">
            <span className="f-mono text-[11px] block" style={{ color: C.yellow }}>O jogo precisa estar finalizado para registrar o resultado</span>
            <button onClick={finalizar}
              className="f-sora font-semibold text-xs mt-2 px-3 py-2 rounded-xl"
              style={{ background: C.yellow, color: C.bg }}>Marcar como finalizado</button>
          </div>
        </div>
      ) : (
        <div className="px-4">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="rounded-2xl flex items-center justify-center"
                style={{ width: 50, height: 50, background: C.red + '1a', border: `1.5px solid ${C.bdrR}` }}>
                <IcoShield size={22} color={C.red} />
              </div>
              <span className="f-sora font-bold text-xs text-center" style={{ color: C.text }}>{time?.nome}</span>
              <ScorePad val={nosso} set={setNosso} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="f-sora font-black text-lg" style={{ color: C.muted }}>×</div>
              <div className="f-mono text-[9px]" style={{ color: C.dim }}>PLACAR</div>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="rounded-2xl flex items-center justify-center text-2xl"
                style={{ width: 50, height: 50, background: C.blue + '15', border: `1px solid ${C.bdr}` }}>
                {mod?.emoji ?? '⚔️'}
              </div>
              <span className="f-sora font-bold text-xs text-center" style={{ color: C.muted }}>{advAtletica?.nome ?? '—'}</span>
              <ScorePad val={adv} set={setAdv} />
            </div>
          </div>

          {/* RN17: calculado automaticamente */}
          <div className="flex items-center justify-center py-3 rounded-2xl mb-5"
            style={{ background: resultadoColor(r) + '18', border: `1px solid ${resultadoColor(r)}33` }}>
            <span className="f-sora font-black text-lg" style={{ color: resultadoColor(r) }}>{RESULTADO_LABEL[r]} da {ATLETICA.sigla}</span>
          </div>

          <button onClick={save}
            className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
            style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
            {corrigindo ? 'Salvar correção' : 'Salvar resultado'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Registrar presença (UC18 / RN31) ─────────────────────────────────────────
function PresencaForm({ ev, onBack }: { ev: Evento; onBack: () => void }) {
  const { membros, participacoes, setParticipacoes, showToast, audit, online, nomeUsuario } = useApp()
  const { time } = useEventoInfo(ev)
  const elenco = elencoIds(membros, ev.timeId).sort((a, b) => nomeUsuario(a).localeCompare(nomeUsuario(b)))
  const jaRegistrada = presencaRegistrada(participacoes, ev.id)
  // Pré-preenchida com quem confirmou participação; se já houver registro, mostra o registro
  const [presentes, setPresentes] = useState<Set<string>>(() => new Set(elenco.filter(id => {
    const p = participacaoDe(participacoes, ev.id, id)
    return jaRegistrada ? p?.presente === true : p?.confirmado === true
  })))

  function toggle(id: string) {
    setPresentes(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function save() {
    if (!online()) return
    // Grava apenas "presente"; as respostas dos atletas não são alteradas (RN32)
    setParticipacoes(p => {
      const next = p.map(x => x.eventoId === ev.id && elenco.includes(x.usuarioId) ? { ...x, presente: presentes.has(x.usuarioId) } : x)
      const novos = elenco
        .filter(id => !p.some(x => x.eventoId === ev.id && x.usuarioId === id))
        .map(id => ({ eventoId: ev.id, usuarioId: id, confirmado: null, presente: presentes.has(id) }))
      return [...next, ...novos]
    })
    audit('Presenças', jaRegistrada ? 'Corrigiu presença' : 'Registrou presença',
      `${ev.tipo === 'JOGO' ? 'Jogo' : 'Treino'} ${time?.nome} · ${fmtFull(ev.inicio)} · ${presentes.size} de ${elenco.length}`)
    showToast(`Presença salva — ${presentes.size} de ${elenco.length} presentes`, 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <div>
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{jaRegistrada ? 'Corrigir presença' : 'Registrar presença'}</h3>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{presentes.size} de {elenco.length} presentes</p>
        </div>
      </div>

      {elenco.length === 0
        ? <div className="px-4"><EmptyState message="Este time não tem elenco" /></div>
        : (
          <div className="flex flex-col gap-2 px-4">
            {elenco.map(id => {
              const present = presentes.has(id)
              const resp = participacaoDe(participacoes, ev.id, id)?.confirmado
              return (
                <button key={id} onClick={() => toggle(id)}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
                  style={{ background: present ? C.green + '15' : C.card2, border: `1px solid ${present ? C.green + '44' : C.bdr}` }}>
                  <Av s={initials(nomeUsuario(id))} size={36} bg={present ? C.green : C.card} />
                  <div className="flex-1">
                    <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{nomeUsuario(id)}</span>
                    <div className="mt-0.5">
                      {resp === true && <Chip label="CONFIRMOU" color={C.blue} />}
                      {resp === false && <Chip label="DISSE QUE NÃO IA" color={C.yellow} />}
                      {(resp === null || resp === undefined) && <Chip label="SEM RESPOSTA" color={C.dim} />}
                    </div>
                  </div>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 22, height: 22, background: present ? C.green : C.dim }}>
                    {present && <IcoCheck size={12} color="#fff" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}

      <div className="px-4">
        <button onClick={save} disabled={elenco.length === 0}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
          style={{ background: elenco.length ? C.red : C.dim, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          Salvar presenças
        </button>
      </div>
    </div>
  )
}

// ─── Detalhe do evento no painel ──────────────────────────────────────────────
function EventDetail({ ev, onBack, onEdit, onResult, onPresenca }:
  { ev: Evento; onBack: () => void; onEdit: () => void; onResult: () => void; onPresenca: () => void }) {
  const { role, eventos, setEventos, participacoes, setParticipacoes, membros, showConfirm, showToast, audit, online } = useApp()
  const { titulo, mod } = useEventoInfo(ev)
  const [escopoCancel, setEscopoCancel] = useState(false)
  const r = resultadoDoEvento(ev)
  const cont = contagemParticipacao(participacoes, membros, ev)
  const registrada = presencaRegistrada(participacoes, ev.id)
  const isCancelado = ev.status === 'Cancelado'
  // RN26 / UC16 A6: excluir só sem respostas, presenças ou resultado
  const temVinculos = participacoes.some(p => p.eventoId === ev.id && (p.confirmado !== null || p.presente !== null)) || r !== null

  function alterarStatus(s: EventoStatus) {
    if (isCancelado || s === ev.status || !online()) return
    setEventos(p => p.map(e => e.id === ev.id ? { ...e, status: s } : e))
    audit('Eventos', `Alterou status para ${s}`, `${titulo} · ${fmtFull(ev.inicio)}`)
    showToast(`Status alterado para ${s}`, 'success')
  }

  function cancelar(escopo: Escopo) {
    if (!online()) return
    const alvo = (e: Evento) => e.id === ev.id || (escopo === 'seguintes' && !!ev.serieId && e.serieId === ev.serieId && e.inicio >= ev.inicio && e.status === 'Agendado')
    const n = eventos.filter(alvo).length
    setEventos(p => p.map(e => alvo(e) ? { ...e, status: 'Cancelado' } : e))
    audit('Eventos', escopo === 'seguintes' ? `Cancelou ${n} treinos da série` : 'Cancelou evento', `${titulo} · ${fmtFull(ev.inicio)}`)
    showToast(n > 1 ? `${n} treinos cancelados — elenco notificado` : 'Evento cancelado — elenco notificado', 'success')
  }

  function excluir() {
    if (!online()) return
    setEventos(p => p.filter(e => e.id !== ev.id))
    setParticipacoes(p => p.filter(x => x.eventoId !== ev.id))
    audit('Eventos', 'Excluiu evento', `${titulo} · ${fmtFull(ev.inicio)}`)
    showToast('Evento excluído', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Chip label={ev.tipo} color={ev.tipo === 'JOGO' ? C.red : C.blue} />
            <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
            <Chip label={ev.status.toUpperCase()} color={statusColor(ev.status)} />
            {ev.serieId && <Chip label="↺ SÉRIE" color={C.muted} />}
          </div>
          <h3 className="f-sora font-black text-base mt-0.5 leading-tight" style={{ color: C.text }}>{titulo}</h3>
        </div>
        {!isCancelado && (
          <button onClick={onEdit} className="flex items-center justify-center rounded-lg p-1.5 shrink-0" style={{ background: C.blue + '22' }} title="Editar">
            <IcoEdit size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4">
        <Card pad="p-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Data e hora', val: fmtFull(ev.inicio) },
              { label: 'Local', val: ev.local },
              { label: 'Participação', val: `${cont.vao.length} vão · ${cont.naoVao.length} não vão` },
              ev.tipo === 'JOGO'
                ? { label: 'Placar', val: r ? `${ev.placarTime} × ${ev.placarAdversario} (${RESULTADO_LABEL[r]})` : '—' }
                : { label: 'Presença', val: registrada ? 'Registrada' : 'Não registrada' },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="f-mono text-[9px] uppercase" style={{ color: C.dim }}>{label}</div>
                <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Status manual (RN14) — evento cancelado não muda mais */}
        <div>
          <p className="f-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: C.dim }}>Alterar status</p>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_ORDER.filter(s => s !== 'Cancelado').map(s => {
              const atual = ev.status === s
              return (
                <button key={s} onClick={() => alterarStatus(s)} disabled={isCancelado}
                  className="px-3 py-1.5 rounded-xl f-mono text-[10px] font-semibold"
                  style={{ background: atual ? statusColor(s) + '22' : C.card2, color: atual ? statusColor(s) : C.muted, border: `1px solid ${atual ? statusColor(s) + '55' : C.bdr}`, opacity: isCancelado ? .4 : 1 }}>
                  {s}
                </button>
              )
            })}
          </div>
          {isCancelado && <p className="f-mono text-[10px] mt-1.5" style={{ color: C.muted }}>Eventos cancelados não podem mudar de status.</p>}
        </div>

        <div className="flex flex-col gap-2">
          {ev.tipo === 'JOGO' && !isCancelado && (
            <button onClick={onResult}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ background: C.yellow + '18', border: `1px solid ${C.yellow}33` }}>
              <span className="f-sora font-semibold text-sm" style={{ color: C.yellow }}>⚡ {r ? 'Corrigir resultado' : 'Registrar resultado'}</span>
              <IcoChev />
            </button>
          )}
          {!isCancelado && (
            <button onClick={onPresenca} disabled={ev.status === 'Agendado'}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ background: C.green + '15', border: `1px solid ${C.green}33`, opacity: ev.status === 'Agendado' ? .5 : 1 }}>
              <span className="f-sora font-semibold text-sm" style={{ color: C.green }}>
                {ev.status === 'Agendado' ? 'Registrar presença — disponível quando o evento começar' : registrada ? 'Corrigir presença' : 'Registrar presença'}
              </span>
              {ev.status !== 'Agendado' && <IcoChev />}
            </button>
          )}
          {!isCancelado && (
            <button onClick={() => ev.serieId
              ? setEscopoCancel(true)
              : showConfirm('Cancelar evento', 'O evento será marcado como cancelado e o elenco será notificado.', () => cancelar('este'), 'Cancelar evento')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ background: '#f43f5e1a', border: '1px solid rgba(244,63,94,.25)' }}>
              <span className="f-sora font-semibold text-sm" style={{ color: '#f43f5e' }}>✕ Cancelar evento</span>
            </button>
          )}
          {canDelete(role) && (
            temVinculos ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
                <IcoAlert size={14} color={C.muted} />
                <span className="f-mono text-[10px]" style={{ color: C.muted }}>
                  Não é possível excluir: há respostas de participação, presenças ou resultado. Cancele o evento.
                </span>
              </div>
            ) : (
              <button onClick={() => showConfirm('Excluir evento', 'O evento será removido. Esta ação não pode ser desfeita.', excluir, 'Excluir')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl"
                style={{ background: '#f43f5e1a', border: '1px solid rgba(244,63,94,.25)' }}>
                <IcoBin size={14} color="#f43f5e" />
                <span className="f-sora font-semibold text-sm" style={{ color: '#f43f5e' }}>Excluir evento</span>
              </button>
            )
          )}
        </div>
      </div>

      {escopoCancel && (
        <EscopoSheet titulo="Cancelar treino recorrente"
          onPick={e => { setEscopoCancel(false); cancelar(e) }}
          onClose={() => setEscopoCancel(false)} />
      )}
    </div>
  )
}

// ─── Seção Eventos (UC16) ─────────────────────────────────────────────────────
export default function EventosSection({ initialResultFilter = false }: { initialResultFilter?: boolean }) {
  const { eventos, setEventos, times, modalidades, audit, showToast, online } = useApp()
  const [view, setView] = useState<EView>('list')
  const [selId, setSelId] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [escopo, setEscopo] = useState<Escopo>('este')
  const [escolherEscopo, setEscolherEscopo] = useState(false)
  const [semResultado, setSemResultado] = useState(initialResultFilter)
  const [fTipo, setFTipo] = useState<'Todos' | EventoTipo>('Todos')
  const [fMod, setFMod]   = useState('Todas')
  const [fStatus, setFStatus] = useState<'Todos' | EventoStatus>('Todos')

  const selected = selId ? eventos.find(e => e.id === selId) : undefined
  const nomeTime = (id?: string) => times.find(t => t.id === id)?.nome ?? '—'

  function matchFilters(ev: Evento) {
    if (semResultado) return ev.tipo === 'JOGO' && ev.status === 'Finalizado' && resultadoDoEvento(ev) === null
    if (fTipo !== 'Todos' && ev.tipo !== fTipo) return false
    if (fStatus !== 'Todos' && ev.status !== fStatus) return false
    if (fMod !== 'Todas') {
      const t = times.find(x => x.id === ev.timeId)
      if (modalidades.find(m => m.id === t?.modalidadeId)?.nome !== fMod) return false
    }
    return true
  }
  const filtered = eventos.filter(matchFilters).sort((a, b) => b.inicio.localeCompare(a.inicio))

  function salvar(f: FormData) {
    if (!online()) return
    const inicio = `${f.data}T${f.hora}:00`
    if (selected && !novo) {
      // Edição: em série, aplica a "somente este" ou "este e os seguintes" (RN13)
      const alvo = (e: Evento) => e.id === selected.id ||
        (escopo === 'seguintes' && !!selected.serieId && e.serieId === selected.serieId && e.inicio > selected.inicio && e.status === 'Agendado')
      setEventos(p => p.map(e => {
        if (!alvo(e)) return e
        const base = { ...e, local: f.local, timeId: f.timeId, timeAdversarioId: f.timeAdversarioId }
        if (e.id === selected.id) return { ...base, inicio }
        return { ...base, inicio: `${e.inicio.slice(0, 10)}T${f.hora}:00` } // mantém a data de cada ocorrência
      }))
      audit('Eventos', escopo === 'seguintes' ? 'Editou este treino e os seguintes' : 'Editou evento', `${nomeTime(f.timeId)} · ${fmtFull(inicio)}`)
      showToast('Evento atualizado — elenco notificado', 'success')
      setView('detail')
      return
    }
    const stamp = Date.now()
    if (f.tipo === 'TREINO' && f.recorrente) {
      const serieId = `serie-${stamp}`
      const datas = ocorrencias(f.data, f.hora, f.dias, f.dataFim)
      setEventos(p => [...p, ...datas.map((d, i) => ({ id: `e${stamp}-${i}`, tipo: f.tipo, timeId: f.timeId, inicio: d, local: f.local, status: 'Agendado' as const, serieId }))])
      audit('Eventos', `Criou série com ${datas.length} treinos`, `${nomeTime(f.timeId)} · até ${f.dataFim.split('-').reverse().join('/')}`)
      // Uma única notificação para a série (seção 3.5)
      showToast(`${datas.length} treinos criados — elenco notificado`, 'success')
    } else {
      setEventos(p => [...p, { id: `e${stamp}`, tipo: f.tipo, timeId: f.timeId, timeAdversarioId: f.timeAdversarioId, inicio, local: f.local, status: 'Agendado' }])
      audit('Eventos', 'Criou evento', `${f.tipo === 'JOGO' ? 'Jogo' : 'Treino'} ${nomeTime(f.timeId)} · ${fmtFull(inicio)}`)
      showToast('Evento criado — elenco notificado', 'success')
    }
    setView('list')
  }

  if (view === 'form') {
    return <EventoForm initial={novo ? undefined : selected} onSave={salvar}
      onBack={() => setView(novo ? 'list' : 'detail')} />
  }
  if (view === 'detail' && selected) {
    return (
      <>
        <EventDetail ev={selected}
          onBack={() => setView('list')}
          onEdit={() => {
            setNovo(false)
            if (selected.serieId) setEscolherEscopo(true)
            else { setEscopo('este'); setView('form') }
          }}
          onResult={() => setView('resultado')}
          onPresenca={() => setView('presenca')}
        />
        {escolherEscopo && (
          <EscopoSheet titulo="Editar treino recorrente"
            onPick={e => { setEscopo(e); setEscolherEscopo(false); setView('form') }}
            onClose={() => setEscolherEscopo(false)} />
        )}
      </>
    )
  }
  if (view === 'resultado' && selected) return <ResultadoForm ev={selected} onBack={() => setView('detail')} />
  if (view === 'presenca' && selected) return <PresencaForm ev={selected} onBack={() => setView('detail')} />

  return (
    <div className="flex flex-col gap-3 pb-4">
      {semResultado ? (
        <div className="mx-4 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <span className="f-mono text-[10px] flex-1" style={{ color: C.yellow }}>Jogos finalizados sem resultado</span>
          <button onClick={() => setSemResultado(false)} className="f-mono text-[10px]" style={{ color: C.blueL }}>Ver todos</button>
        </div>
      ) : (
        <div className="px-4 flex flex-col gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            {([['Todos', 'Todos'], ['JOGO', 'Jogos'], ['TREINO', 'Treinos']] as const).map(([v, l]) => (
              <Pill key={v} label={l} active={fTipo === v} color={C.red} onClick={() => setFTipo(v)} />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {['Todas', ...modalidades.map(m => m.nome)].map(m => (
              <Pill key={m} label={m} active={fMod === m} color={C.blue} onClick={() => setFMod(m)} />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {(['Todos', ...STATUS_ORDER] as const).map(s => (
              <Pill key={s} label={s} active={fStatus === s} color={C.yellow} onClick={() => setFStatus(s)} />
            ))}
          </div>
        </div>
      )}

      <div className="px-4">
        <button onClick={() => { setSelId(null); setNovo(true); setView('form') }}
          className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          <IcoPlus size={15} /> Novo evento
        </button>
      </div>

      {filtered.length === 0
        ? <div className="px-4"><EmptyState message="Nenhum evento encontrado" action="Limpar filtros"
            onAction={() => { setSemResultado(false); setFTipo('Todos'); setFMod('Todas'); setFStatus('Todos') }} /></div>
        : (
          <div className="flex flex-col gap-2 px-4">
            {filtered.map(ev => <PainelEventoCard key={ev.id} ev={ev} onClick={() => { setSelId(ev.id); setNovo(false); setView('detail') }} />)}
          </div>
        )}
    </div>
  )
}

function PainelEventoCard({ ev, onClick }: { ev: Evento; onClick: () => void }) {
  const { participacoes } = useApp()
  const { titulo, mod } = useEventoInfo(ev)
  const r = resultadoDoEvento(ev)
  const pendencia = ev.status === 'Finalizado' && ev.tipo === 'JOGO' && !r
    ? 'Sem resultado'
    : (ev.status === 'Finalizado' || ev.status === 'Em andamento') && !presencaRegistrada(participacoes, ev.id)
      ? 'Presença a registrar' : null
  return (
    <Card onClick={onClick} pad="p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <Chip label={ev.tipo} color={ev.tipo === 'JOGO' ? C.red : C.blue} />
            <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
            <Chip label={ev.status.toUpperCase()} color={statusColor(ev.status)} />
            {r && <Chip label={RESULTADO_LABEL[r].toUpperCase()} color={resultadoColor(r)} />}
            {pendencia && <Chip label={pendencia.toUpperCase()} color={C.yellow} />}
          </div>
          <div className="f-sora font-semibold text-sm truncate" style={{ color: C.text, textDecoration: ev.status === 'Cancelado' ? 'line-through' : 'none' }}>{titulo}</div>
          <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{fmtCard(ev.inicio)} · {ev.local}</div>
        </div>
        <IcoChev />
      </div>
    </Card>
  )
}

