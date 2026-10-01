import { useState } from 'react'
import { C } from '../../theme'
import { fmtCard, fmtFull, canDelete, initials } from '../../utils'
import { Card, Chip, Pill, Av, IcoBack, IcoPlus, IcoCheck, IcoX, IcoBin, IcoEdit, IcoAlert, IcoShield, IcoChev } from '../../components/atoms'
import { EmptyState } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Evento, EventoStatus } from '../../types'

type EView = 'list' | 'form' | 'detail' | 'resultado' | 'presenca' | 'scope'

const STATUS_ORDER: EventoStatus[] = ['Agendado', 'Em andamento', 'Finalizado', 'Cancelado']
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const GRADIENTS = [
  'linear-gradient(135deg,#e11d48,#9f1239)',
  'linear-gradient(135deg,#2563eb,#1e3a8a)',
  'linear-gradient(135deg,#7c3aed,#4c1d95)',
  'linear-gradient(135deg,#0891b2,#164e63)',
  'linear-gradient(135deg,#059669,#064e3b)',
  'linear-gradient(135deg,#d97706,#78350f)',
]

function countOccurrences(startIso: string, days: number[], endDateStr: string) {
  if (!startIso || !endDateStr || days.length === 0) return 0
  const end = new Date(endDateStr + 'T23:59:59')
  const cur  = new Date(startIso); cur.setHours(0, 0, 0, 0)
  let n = 0
  while (cur <= end && n < 200) { if (days.includes(cur.getDay())) n++; cur.setDate(cur.getDate() + 1) }
  return n
}

// ─── Confirm sheet ────────────────────────────────────────────────────────────
function ConfirmSheet({ title, msg, confirmLabel, confirmColor = C.red, onOk, onCancel }:
  { title: string; msg: string; confirmLabel: string; confirmColor?: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-5 a-up" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center rounded-2xl" style={{ width: 40, height: 40, background: confirmColor + '1a' }}>
            <IcoAlert size={20} color={confirmColor} />
          </div>
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{title}</h3>
        </div>
        <p className="f-mono text-xs mb-5 leading-relaxed" style={{ color: C.muted }}>{msg}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>Cancelar</button>
          <button onClick={onOk} className="flex-1 py-3 rounded-2xl f-sora font-bold text-sm"
            style={{ background: confirmColor, color: '#fff', boxShadow: `0 4px 12px ${confirmColor}44` }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── New adversário bottom sheet ──────────────────────────────────────────────
function NewAdvSheet({ onAdd, onClose }: { onAdd: (atletica: string, curso: string, time: string) => void; onClose: () => void }) {
  const [atl, setAtl] = useState(''); const [curso, setCurso] = useState(''); const [time, setTime] = useState('')
  function FInput({ label, val, set }: { label: string; val: string; set: (v: string) => void }) {
    return (
      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>{label}</label>
        <input value={val} onChange={e => set(e.target.value)} className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
          style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
      </div>
    )
  }
  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-5 a-up" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Cadastrar adversário</h3>
          <button onClick={onClose} style={{ color: C.muted }}><IcoX size={18} /></button>
        </div>
        <div className="flex flex-col gap-3 mb-5">
          <FInput label="Nome da atlética" val={atl} set={setAtl} />
          <FInput label="Curso" val={curso} set={setCurso} />
          <FInput label="Nome do time" val={time} set={setTime} />
        </div>
        <button onClick={() => { if (atl && curso && time) { onAdd(atl, curso, time); onClose() } }}
          disabled={!atl || !curso || !time}
          className="w-full py-3 rounded-2xl f-sora font-bold text-sm"
          style={{ background: (atl && curso && time) ? C.blue : C.dim, color: '#fff' }}>
          Cadastrar
        </button>
      </div>
    </div>
  )
}

// ─── Evento form ──────────────────────────────────────────────────────────────
function EventoForm({ initial, onSave, onBack }:
  { initial?: Evento; onSave: (ev: any) => void; onBack: () => void }) {
  const { showToast, times: TIMES, modalidades: MODALIDADES, atleticas: ATLETICAS, setTimes, setAtleticas, audit } = useApp()
  const [tipo, setTipo]         = useState<'JOGO' | 'TREINO'>(initial?.tipo ?? 'JOGO')
  const [timeId, setTimeId]     = useState(initial?.timeLordeId ?? '')
  const [advId, setAdvId]       = useState(initial?.timeAdvId ?? '')
  const [inicio, setInicio]     = useState(initial?.inicio?.slice(0, 10) ?? '')
  const [hora, setHora]         = useState(initial?.inicio?.slice(11, 16) ?? '18:00')
  const [local, setLocal]       = useState(initial?.local ?? '')
  const [recorrente, setRecorrente] = useState(initial?.recorrente ?? false)
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [dataFim, setDataFim]   = useState('')
  const [showNewAdv, setShowNewAdv] = useState(false)
  const [extraAdvs, setExtraAdvs]   = useState<{ id: string; nome: string; atleticaNome: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const lordeTimes = TIMES.filter(t => t.atleticaId === 'lorde')
  const selTime = lordeTimes.find(t => t.id === timeId)
  const advTimes = [
    ...TIMES.filter(t => t.atleticaId !== 'lorde' && t.modalidadeId === selTime?.modalidadeId),
    ...extraAdvs.map(e => ({ id: e.id, nome: e.nome, atleticaId: e.atleticaNome, modalidadeId: selTime?.modalidadeId ?? '' } as any)),
  ]
  const occurrences = countOccurrences(`${inicio}T${hora}`, weekDays, dataFim)

  function toggleDay(d: number) {
    setWeekDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])
  }

  function save() {
    const nextErrors: Record<string, string> = {}
    if (!timeId) nextErrors.timeId = 'Selecione o time da Lorde'
    if (tipo === 'JOGO' && !advId) nextErrors.advId = 'Jogo exige time adversário'
    if (!inicio) nextErrors.inicio = 'Informe a data'
    if (!local.trim()) nextErrors.local = 'Informe o local'
    if (tipo === 'TREINO' && recorrente && !initial) {
      if (!weekDays.length) nextErrors.weekDays = 'Selecione ao menos um dia da semana'
      if (!dataFim || dataFim <= inicio) nextErrors.dataFim = '"Repetir até" deve ser posterior à data de início'
      if (inicio && dataFim) {
        const max = new Date(`${inicio}T12:00:00`)
        max.setMonth(max.getMonth() + 6)
        if (new Date(`${dataFim}T12:00:00`) > max) nextErrors.dataFim = 'A série pode ter no máximo 6 meses'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const isoInicio = `${inicio}T${hora}:00`
    onSave({
      id: initial?.id,
      tipo,
      timeLordeId: timeId,
      timeAdvId: tipo === 'JOGO' ? advId : undefined,
      inicio: isoInicio,
      local,
      status: initial?.status ?? 'Agendado',
      confirmados: initial?.confirmados ?? [],
      recorrente: tipo === 'TREINO' && recorrente,
      serieId: initial?.serieId ?? (tipo === 'TREINO' && recorrente ? `serie-${timeId}-${Date.now()}` : undefined),
      participacoes: initial?.participacoes ?? [],
      _weekDays: weekDays,
      _dataFim: dataFim,
    })
    showToast(initial ? 'Evento atualizado — elenco notificado' : 'Evento criado — elenco notificado', 'success')
    onBack()
  }

  function FInput({ label, value, onChange, type = 'text', required, error }:
    { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; error?: string }) {
    return (
      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>
          {label}{required && <span style={{ color: C.red }}> *</span>}
        </label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
          style={{ background: C.card2, border: `1px solid ${error ? '#f43f5e' : C.bdr}`, color: C.text, caretColor: C.red }} />
        {error && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6 overflow-y-auto a-up relative">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>
          {initial ? 'Editar evento' : 'Novo evento'}
        </h3>
      </div>

      {/* Tipo segmented */}
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.bdr}`, background: C.card }}>
          {(['JOGO', 'TREINO'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className="py-2.5 f-sora font-semibold text-sm"
              style={{ background: tipo === t ? C.red : 'transparent', color: tipo === t ? '#fff' : C.muted }}>
              {t === 'JOGO' ? '⚔️ Jogo' : '🏋️ Treino'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4">
        {/* Time da Lorde */}
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>
            Time da Lorde <span style={{ color: C.red }}>*</span>
          </label>
          <div className="flex flex-col gap-1.5">
            {lordeTimes.map(t => {
              const mod = MODALIDADES.find(m => m.id === t.modalidadeId)
              return (
                <button key={t.id} onClick={() => { setTimeId(t.id); setAdvId('') }}
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

        {/* Adversário (Jogo) */}
        {tipo === 'JOGO' && (
          <div>
            <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Time adversário</label>
            {selTime ? (
              <>
                {advTimes.length === 0
                  ? <p className="f-mono text-xs" style={{ color: C.dim }}>Nenhum time adversário desta modalidade cadastrado.</p>
                  : (
                    <div className="flex flex-col gap-1.5 mb-2">
                      {advTimes.map(t => {
                        const atl = ATLETICAS.find(a => a.id === t.atleticaId)
                        return (
                          <button key={t.id} onClick={() => setAdvId(t.id)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                            style={{ background: advId === t.id ? C.blue + '18' : C.card2, border: `1px solid ${advId === t.id ? C.bdrB : C.bdr}` }}>
                            <div className="flex-1">
                              <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{t.nome}</div>
                              <div className="f-mono text-[9px]" style={{ color: C.muted }}>{atl?.nome}</div>
                            </div>
                            {advId === t.id && <IcoCheck size={14} color={C.blueL} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                <button onClick={() => setShowNewAdv(true)}
                  className="flex items-center gap-1.5 f-mono text-[10px]" style={{ color: C.blueL }}>
                  <IcoPlus size={12} color={C.blueL} /> Cadastrar atlética/time adversário
                </button>
                {errors.advId && <p className="f-mono text-[10px]" style={{ color: '#f87171' }}>{errors.advId}</p>}
              </>
            ) : (
              <p className="f-mono text-xs" style={{ color: C.dim }}>Selecione um time da Lorde primeiro</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FInput label="Data" value={inicio} onChange={setInicio} type="date" required error={errors.inicio} />
          <FInput label="Horário" value={hora} onChange={setHora} type="time" />
        </div>
        <FInput label="Local" value={local} onChange={setLocal} required error={errors.local} />

        {/* Recorrente (Treino) */}
        {tipo === 'TREINO' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="f-sora font-medium text-sm" style={{ color: C.text }}>Treino recorrente</span>
              <button onClick={() => setRecorrente(v => !v)}
                className="rounded-full transition-all" style={{ width: 44, height: 24, background: recorrente ? C.green : C.dim, padding: 3 }}>
                <div className="rounded-full transition-all" style={{ width: 18, height: 18, background: '#fff', transform: `translateX(${recorrente ? 20 : 0}px)` }} />
              </button>
            </div>
            {recorrente && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>Dias da semana</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEKDAYS.map((d, i) => (
                      <button key={i} onClick={() => toggleDay(i)}
                        className="px-2.5 py-1 rounded-lg f-mono text-[10px] font-semibold"
                        style={{ background: weekDays.includes(i) ? C.blue + '22' : C.card2, color: weekDays.includes(i) ? C.blueL : C.muted, border: `1px solid ${weekDays.includes(i) ? C.bdrB : C.bdr}` }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {errors.weekDays && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{errors.weekDays}</p>}
                </div>
                <FInput label="Repetir até" value={dataFim} onChange={setDataFim} type="date" error={errors.dataFim} />
                {occurrences > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.blue + '15', border: `1px solid ${C.bdrB}` }}>
                    <IcoCheck size={13} color={C.blueL} />
                    <span className="f-mono text-xs" style={{ color: C.blueL }}>Serão criados {occurrences} treinos</span>
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

      {showNewAdv && (
        <NewAdvSheet
          onAdd={(atl, curso, time) => {
            const stamp = Date.now()
            const atlId = `atl-${stamp}`
            const newId = `adv-${stamp}`
            setAtleticas(p => [...p, { id: atlId, nome: atl, curso }])
            setTimes(p => [...p, { id: newId, nome: time, atleticaId: atlId, modalidadeId: selTime?.modalidadeId ?? '', ativo: true }])
            setExtraAdvs(p => [...p, { id: newId, nome: time, atleticaNome: atlId }])
            setAdvId(newId)
            audit('Times e elencos', 'Cadastrou atlética adversária', `${atl} · ${curso}`)
          }}
          onClose={() => setShowNewAdv(false)}
        />
      )}
    </div>
  )
}

// ─── Resultado form ───────────────────────────────────────────────────────────
function ResultadoForm({ ev, onSave, onBack }: { ev: Evento; onSave: (ev: Evento) => void; onBack: () => void }) {
  const { showToast, times: TIMES, modalidades: MODALIDADES, atleticas: ATLETICAS } = useApp()
  const [lorde, setLorde] = useState(ev.placar?.lorde ?? 0)
  const [adv, setAdv]     = useState(ev.placar?.adv   ?? 0)
  const tl  = TIMES.find(t => t.id === ev.timeLordeId)
  const ta  = ev.timeAdvId ? TIMES.find(t => t.id === ev.timeAdvId) : null
  const atl = ta ? ATLETICAS.find(a => a.id === ta.atleticaId) : null
  const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)

  const win  = lorde > adv; const draw = lorde === adv
  const label = win ? '🏆 VITÓRIA' : draw ? '🤝 EMPATE' : '❌ DERROTA'
  const col   = win ? C.green : draw ? C.yellow : '#f43f5e'

  function ScorePad({ val, set }: { val: number; set: React.Dispatch<React.SetStateAction<number>> }) {
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

  function save() {
    const updated = { ...ev, status: 'Finalizado' as const, placar: { lorde, adv } }
    onSave(updated)
    showToast(ev.placar ? 'Resultado corrigido — registrado na auditoria' : 'Resultado registrado — registrado na auditoria', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-5 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{ev.placar ? 'Corrigir resultado' : 'Registrar resultado'}</h3>
      </div>

      {ev.status !== 'Finalizado' && (
        <div className="mx-4 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <IcoAlert size={14} color={C.yellow} />
          <div className="flex-1">
            <span className="f-mono text-[10px] block" style={{ color: C.yellow }}>O jogo precisa estar finalizado para registrar o resultado</span>
            <button onClick={() => onSave({ ...ev, status: 'Finalizado' })}
              className="f-sora font-semibold text-xs mt-2 px-3 py-2 rounded-xl"
              style={{ background: C.yellow, color: C.bg }}>Marcar como finalizado</button>
          </div>
        </div>
      )}

      {ev.status === 'Finalizado' && <div className="px-4">
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="rounded-2xl flex items-center justify-center"
              style={{ width: 50, height: 50, background: C.red + '1a', border: `1.5px solid ${C.bdrR}` }}>
              <IcoShield size={22} color={C.red} />
            </div>
            <span className="f-sora font-bold text-xs text-center" style={{ color: C.text }}>{tl?.nome}</span>
            <ScorePad val={lorde} set={setLorde} />
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
            <span className="f-sora font-bold text-xs text-center" style={{ color: C.muted }}>{atl?.nome ?? '—'}</span>
            <ScorePad val={adv} set={setAdv} />
          </div>
        </div>

        <div className="flex items-center justify-center py-3 rounded-2xl mb-5"
          style={{ background: col + '18', border: `1px solid ${col}33` }}>
          <span className="f-sora font-black text-lg" style={{ color: col }}>{label}</span>
        </div>

        <button onClick={save}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          Salvar resultado
        </button>
      </div>}
    </div>
  )
}

// ─── Presença form ────────────────────────────────────────────────────────────
function PresencaForm({ ev, onSave, onBack }: { ev: Evento; onSave: (ev: Evento) => void; onBack: () => void }) {
  const { showToast, times: TIMES, usuarios } = useApp()
  const tl = TIMES.find(t => t.id === ev.timeLordeId)
  const atletas = tl?.atletas ?? []
  const [presentes, setPresentes] = useState<Set<string>>(new Set(
    (ev.participacoes ?? []).filter(p => p.presente).map(p => p.nome),
  ))

  function toggle(nome: string) {
    setPresentes(p => { const n = new Set(p); n.has(nome) ? n.delete(nome) : n.add(nome); return n })
  }

  function save() {
    const prior = ev.participacoes ?? []
    onSave({
      ...ev,
      participacoes: atletas.map(nome => {
        const old = prior.find(p => p.nome === nome)
        return { usuarioId: old?.usuarioId ?? nome, nome, resposta: old?.resposta, presente: presentes.has(nome) }
      }),
    })
    showToast(`Presença salva — ${presentes.size} de ${atletas.length} presentes`, 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <div>
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Registrar presença</h3>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{presentes.size} de {atletas.length} presentes</p>
        </div>
      </div>

      {atletas.length === 0
        ? <div className="px-4"><EmptyState message="Este time não tem elenco cadastrado" /></div>
        : (
          <div className="flex flex-col gap-2 px-4">
            {atletas.map(nome => {
              const present = presentes.has(nome)
              const response = (ev.participacoes ?? []).find(p => p.nome === nome)?.resposta
              const userId = usuarios.find(u => u.nome === nome)?.id
              const hadConfirmed = response === 'VOU' || ev.confirmados.includes(nome) || (!!userId && ev.confirmados.includes(userId))
              return (
                <button key={nome} onClick={() => toggle(nome)}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
                  style={{ background: present ? C.green + '15' : C.card2, border: `1px solid ${present ? C.green + '44' : C.bdr}` }}>
                  <Av s={initials(nome)} size={36} bg={present ? C.green : C.card} />
                  <div className="flex-1">
                    <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{nome}</span>
                    {hadConfirmed && (
                      <div><Chip label="Confirmou" color={C.blue} /></div>
                    )}
                    {response === 'NAO_VOU' && <div><Chip label="Disse que não ia" color={C.yellow} /></div>}
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
        <button onClick={save}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          Salvar presenças
        </button>
      </div>
    </div>
  )
}

// ─── Event detail ──────────────────────────────────────────────────────────────
function EventDetail({ ev, onBack, onEdit, onResult, onPresenca, onDelete, onStatusChange }:
  { ev: Evento; onBack: () => void; onEdit: () => void; onResult: () => void; onPresenca: () => void; onDelete: () => void; onStatusChange: (s: EventoStatus, following?: boolean) => void }) {
  const { role, showConfirm, times: TIMES, modalidades: MODALIDADES, atleticas: ATLETICAS } = useApp()
  const [showCancel, setShowCancel] = useState(false)
  const [showRecurModal, setShowRecurModal] = useState(false)
  const tl  = TIMES.find(t => t.id === ev.timeLordeId)
  const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
  const canDel = canDelete(role)
  const hasActivity = ev.confirmados.length > 0 || !!ev.placar || (ev.participacoes ?? []).some(p => p.resposta || p.presente !== undefined)

  return (
    <div className="flex flex-col gap-4 pb-6 a-up relative">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Chip label={ev.tipo} color={ev.tipo === 'JOGO' ? C.red : C.blue} />
            <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
            <Chip label={ev.status} color={ev.status === 'Em andamento' ? C.green : ev.status === 'Cancelado' ? '#f43f5e' : C.muted} />
          </div>
          <h3 className="f-sora font-black text-base mt-0.5" style={{ color: C.text }}>{tl?.nome}</h3>
        </div>
        <button onClick={onEdit} className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.blue + '22' }}>
          <IcoEdit size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <Card pad="p-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Data/hora', val: fmtFull(ev.inicio) },
              { label: 'Local', val: ev.local },
              { label: 'Confirmados', val: `${ev.confirmados.length}` },
              { label: 'Placar', val: ev.placar ? `${ev.placar.lorde}–${ev.placar.adv}` : '—' },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="f-mono text-[9px] uppercase" style={{ color: C.dim }}>{label}</div>
                <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Status selector */}
        <div>
          <p className="f-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: C.dim }}>Alterar status</p>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_ORDER.filter(s => s !== 'Cancelado').map(s => (
              <button key={s} onClick={() => onStatusChange(s)} disabled={ev.status === 'Cancelado'}
                className="px-3 py-1.5 rounded-xl f-mono text-[10px] font-semibold"
                style={{ background: ev.status === s ? (s === 'Em andamento' ? C.green : s === 'Finalizado' ? C.muted : C.blue) + '22' : C.card2, color: ev.status === s ? (s === 'Em andamento' ? C.green : s === 'Finalizado' ? C.text : C.blueL) : C.muted, border: `1px solid ${ev.status === s ? C.bdr : C.bdr}` }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {ev.tipo === 'JOGO' && ev.status !== 'Cancelado' && (
            <button onClick={onResult}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ background: C.yellow + '18', border: `1px solid ${C.yellow}33` }}>
              <span className="f-sora font-semibold text-sm" style={{ color: C.yellow }}>⚡ Registrar resultado</span>
              <IcoChev />
            </button>
          )}
          <button onClick={onPresenca} disabled={!['Em andamento', 'Finalizado'].includes(ev.status)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: C.green + '15', border: `1px solid ${C.green}33` }}>
            <span className="f-sora font-semibold text-sm" style={{ color: C.green }}>
              {ev.status === 'Agendado' ? 'Disponível quando o evento começar' : 'Registrar presença'}
            </span>
            <IcoChev />
          </button>
          {ev.status !== 'Cancelado' && <button onClick={() => ev.recorrente ? setShowRecurModal(true) : setShowCancel(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: '#f43f5e1a', border: '1px solid rgba(244,63,94,.25)' }}>
            <span className="f-sora font-semibold text-sm" style={{ color: '#f43f5e' }}>✕ Cancelar evento</span>
          </button>}
          {canDel ? (
            hasActivity ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
                <IcoAlert size={14} color={C.muted} />
                <span className="f-mono text-[10px]" style={{ color: C.muted }}>Não é possível excluir: há confirmações ou resultado</span>
              </div>
            ) : (
              <button onClick={() => showConfirm('Excluir evento', 'Esta ação é irreversível.', onDelete)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl"
                style={{ background: '#f43f5e1a', border: '1px solid rgba(244,63,94,.25)' }}>
                <IcoBin size={14} color="#f43f5e" />
                <span className="f-sora font-semibold text-sm" style={{ color: '#f43f5e' }}>Excluir evento</span>
              </button>
            )
          ) : null}
        </div>
      </div>

      {showCancel && (
        <ConfirmSheet title="Cancelar evento" msg="O evento será marcado como cancelado e o elenco será notificado."
          confirmLabel="Cancelar evento" confirmColor="#f43f5e"
          onOk={() => { onStatusChange('Cancelado'); setShowCancel(false) }}
          onCancel={() => setShowCancel(false)} />
      )}
      {showRecurModal && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full rounded-t-3xl p-5 a-up" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
            <h3 className="f-sora font-black text-base mb-4" style={{ color: C.text }}>Cancelar treino recorrente</h3>
            {['Somente este treino', 'Este e os seguintes'].map((opt, index) => (
              <button key={opt} onClick={() => { onStatusChange('Cancelado', index === 1); setShowRecurModal(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 text-left"
                style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
                <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{opt}</span>
              </button>
            ))}
            <button onClick={() => setShowRecurModal(false)} className="w-full py-3 f-mono text-sm" style={{ color: C.muted }}>Não cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main EventosSection ──────────────────────────────────────────────────────
export default function EventosSection({ initialResultFilter = false }: { initialResultFilter?: boolean }) {
  const {
    eventos, setEventos, times: TIMES, modalidades: MODALIDADES, audit,
  } = useApp()
  const [view, setView] = useState<EView>('list')
  const [selected, setSelected] = useState<Evento | null>(null)
  const [editingNew, setEditingNew] = useState(false)
  const [fTipo, setFTipo] = useState(initialResultFilter ? 'JOGO' : 'Todos')
  const [fMod, setFMod]   = useState('Todas')
  const [fStatus, setFStatus] = useState(initialResultFilter ? 'Finalizado' : 'Todos')
  const [applyFollowing, setApplyFollowing] = useState(false)

  function matchFilters(ev: Evento) {
    if (initialResultFilter && (ev.tipo !== 'JOGO' || ev.status !== 'Finalizado' || !!ev.placar)) return false
    if (fTipo !== 'Todos' && ev.tipo !== fTipo) return false
    if (fStatus !== 'Todos' && ev.status !== fStatus) return false
    if (fMod !== 'Todas') {
      const tl = TIMES.find(t => t.id === ev.timeLordeId)
      const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
      if (mod?.nome !== fMod) return false
    }
    return true
  }

  const filtered = eventos.filter(matchFilters).sort((a, b) => b.inicio.localeCompare(a.inicio))

  function saveEvento(data: any) {
    const { _weekDays = [], _dataFim = '', ...clean } = data
    if (data.id) {
      setEventos(p => p.map(e => {
        const inScope = e.id === data.id || (
          applyFollowing && selected?.serieId && e.serieId === selected.serieId && e.inicio >= selected.inicio
        )
        if (!inScope) return e
        return { ...e, ...clean, id: e.id, inicio: e.id === data.id ? clean.inicio : e.inicio }
      }))
      audit('Eventos', applyFollowing ? 'Atualizou este treino e os seguintes' : 'Atualizou evento', `${clean.tipo} · ${clean.inicio}`)
    } else {
      const baseId = Date.now()
      if (clean.recorrente && _weekDays.length && _dataFim) {
        const occurrences: Evento[] = []
        const cursor = new Date(clean.inicio)
        const end = new Date(`${_dataFim}T23:59:59`)
        const time = clean.inicio.slice(11)
        while (cursor <= end && occurrences.length < 200) {
          if (_weekDays.includes(cursor.getDay())) {
            const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}T${time}`
            occurrences.push({ ...clean, id: `e${baseId}-${occurrences.length}`, inicio: date })
          }
          cursor.setDate(cursor.getDate() + 1)
        }
        setEventos(p => [...p, ...occurrences])
        audit('Eventos', 'Criou série recorrente', `${occurrences.length} treinos`)
      } else {
        setEventos(p => [...p, { ...clean, id: `e${baseId}` }])
        audit('Eventos', 'Criou evento', `${clean.tipo} · ${clean.inicio}`)
      }
    }
  }

  if (view === 'scope' && selected) {
    return (
      <div className="px-4 pt-4">
        <Card>
          <h3 className="f-sora font-black text-base mb-4" style={{ color: C.text }}>Aplicar alteração a:</h3>
          {['Somente este treino', 'Este e os seguintes'].map((label, index) => (
            <button key={label} onClick={() => { setApplyFollowing(index === 1); setView('form') }}
              className="w-full px-4 py-3 rounded-xl text-left mb-2 f-sora font-semibold text-sm"
              style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text }}>{label}</button>
          ))}
          <button onClick={() => setView('detail')} className="w-full py-3 f-mono text-xs" style={{ color: C.muted }}>Cancelar</button>
        </Card>
      </div>
    )
  }

  if (view === 'form') {
    return (
      <EventoForm
        initial={editingNew ? undefined : selected ?? undefined}
        onSave={saveEvento}
        onBack={() => { setView(selected && !editingNew ? 'detail' : 'list') }}
      />
    )
  }
  if (view === 'detail' && selected) {
    const ev = eventos.find(e => e.id === selected.id) ?? selected
    return (
      <EventDetail ev={ev}
        onBack={() => setView('list')}
        onEdit={() => { setEditingNew(false); setView(ev.serieId ? 'scope' : 'form') }}
        onResult={() => setView('resultado')}
        onPresenca={() => setView('presenca')}
        onDelete={() => {
          setEventos(p => p.filter(e => e.id !== ev.id))
          audit('Eventos', 'Excluiu evento', `${ev.tipo} · ${ev.inicio}`)
          setView('list')
        }}
        onStatusChange={(s, following) => {
          setEventos(p => p.map(e => {
            const scoped = e.id === ev.id || (following && ev.serieId && e.serieId === ev.serieId && e.inicio >= ev.inicio)
            return scoped ? { ...e, status: s } : e
          }))
          audit('Eventos', s === 'Cancelado' ? 'Cancelou evento' : 'Alterou status', `${ev.tipo} · ${s}`)
        }}
      />
    )
  }
  if (view === 'resultado' && selected) {
    const ev = eventos.find(e => e.id === selected.id) ?? selected
    return <ResultadoForm ev={ev} onSave={u => {
      setEventos(p => p.map(e => e.id === u.id ? u : e))
      audit(u.placar ? 'Resultados' : 'Eventos', u.placar ? (ev.placar ? 'Corrigiu resultado' : 'Registrou resultado') : 'Finalizou jogo', `${u.tipo} · ${u.inicio}`)
    }} onBack={() => setView('detail')} />
  }
  if (view === 'presenca' && selected) {
    const ev = eventos.find(e => e.id === selected.id) ?? selected
    return <PresencaForm ev={ev} onSave={u => {
      setEventos(p => p.map(e => e.id === u.id ? u : e))
      audit('Presenças', 'Registrou presença', `${u.tipo} · ${u.inicio}`)
    }} onBack={() => setView('detail')} />
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="px-4 flex flex-col gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {['Todos', 'JOGO', 'TREINO'].map(t => (
            <Pill key={t} label={t} active={fTipo === t} color={C.red} onClick={() => setFTipo(t)} />
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['Todas', ...MODALIDADES.map(m => m.nome)].map(m => (
            <Pill key={m} label={m} active={fMod === m} color={C.blue} onClick={() => setFMod(m)} />
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['Todos', ...STATUS_ORDER].map(s => (
            <Pill key={s} label={s} active={fStatus === s} color={C.yellow} onClick={() => setFStatus(s)} />
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <div className="px-4"><EmptyState message="Nenhum evento encontrado" action="Limpar filtros" onAction={() => { setFTipo('Todos'); setFMod('Todas'); setFStatus('Todos') }} /></div>
        : (
          <div className="flex flex-col gap-2 px-4">
            {filtered.map(ev => {
              const tl  = TIMES.find(t => t.id === ev.timeLordeId)
              const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
              return (
                <Card key={ev.id} onClick={() => { setSelected(ev); setView('detail') }} pad="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <Chip label={ev.tipo} color={ev.tipo === 'JOGO' ? C.red : C.blue} />
                        <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
                        <Chip label={ev.status} color={ev.status === 'Em andamento' ? C.green : ev.status === 'Cancelado' ? '#f43f5e' : C.muted} />
                      </div>
                      <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{tl?.nome}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{fmtCard(ev.inicio)} · {ev.local}</div>
                    </div>
                    <IcoChev />
                  </div>
                </Card>
              )
            })}
          </div>
        )}

      <div className="px-4">
        <button onClick={() => { setSelected(null); setEditingNew(true); setView('form') }}
          className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          <IcoPlus size={15} /> Novo evento
        </button>
      </div>
    </div>
  )
}
