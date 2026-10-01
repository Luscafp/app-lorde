import { useState } from 'react'
import { C } from '../../theme'
import { initials } from '../../utils'
import { Card, Chip, Av, IcoBack, IcoPlus, IcoCheck, IcoX, IcoBin, IcoEdit, IcoAlert, IcoStar } from '../../components/atoms'
import { EmptyState } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Time, Modalidade } from '../../types'

// ─── Elenco manager ───────────────────────────────────────────────────────────
function ElencoView({ time, onBack }: { time: Time; onBack: () => void }) {
  const {
    showToast, showConfirm, times, setTimes, modalidades: MODALIDADES,
    solicitacoes, audit,
  } = useApp()
  const liveTime = times.find(t => t.id === time.id) ?? time
  const atletas = liveTime.atletas ?? []
  const capitao = liveTime.capitao
  const mod = MODALIDADES.find(m => m.id === time.modalidadeId)
  const pending = solicitacoes.filter(s => s.timeId === time.id && s.status === 'PENDENTE').length

  function removeAtleta(nome: string) {
    showConfirm('Remover atleta', `Remover ${nome} do elenco do ${time.nome}?`, () => {
      setTimes(p => p.map(t => t.id === time.id ? {
        ...t,
        atletas: (t.atletas ?? []).filter(a => a !== nome),
        capitao: t.capitao === nome ? undefined : t.capitao,
      } : t))
      audit('Times e elencos', 'Removeu atleta do elenco', `${nome} · ${time.nome}`)
      showToast('Atleta removido', 'error')
    })
  }

  function setAsCapitao(nome: string) {
    setTimes(p => p.map(t => t.id === time.id ? { ...t, capitao: t.capitao === nome ? undefined : nome } : t))
    audit('Times e elencos', capitao === nome ? 'Removeu capitão' : 'Definiu capitão', `${nome} · ${time.nome}`)
    showToast(capitao === nome ? 'Capitão removido' : `${nome.split(' ')[0]} definido como capitão!`, 'success')
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <div>
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{time.nome}</h3>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>
            {mod?.emoji} {mod?.nome} · {atletas.length} atletas
          </p>
        </div>
      </div>

      {capitao && (
        <div className="mx-4 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <IcoStar size={14} />
          <span className="f-mono text-[10px]" style={{ color: C.yellow }}>Capitão: {capitao}</span>
        </div>
      )}

      <div className="mx-4 px-3 py-2.5 rounded-xl f-mono text-[10px]"
        style={{ color: C.yellow, background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
        Solicitações pendentes deste time ({pending})
      </div>

      {/* Elenco list */}
      {atletas.length === 0
        ? <div className="px-4"><EmptyState message="Elenco vazio" /></div>
        : (
          <div className="flex flex-col gap-2 px-4">
            {atletas.map((nome, i) => {
              const isCap = capitao === nome
              return (
                <Card key={nome} pad="p-3">
                  <div className="flex items-center gap-3">
                    <span className="f-mono text-[10px] shrink-0" style={{ color: C.dim, width: 20 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Av s={initials(nome)} size={36} bg={isCap ? `linear-gradient(135deg,${mod?.cor ?? C.red},${mod?.cor ?? C.red}88)` : C.card2} />
                    <span className="f-sora font-medium text-sm flex-1" style={{ color: C.text }}>{nome}</span>
                    {/* Set capitão */}
                    <button onClick={() => setAsCapitao(nome)}
                      className="flex items-center justify-center rounded-lg p-1.5"
                      style={{ background: isCap ? C.yellow + '22' : C.card2, border: `1px solid ${isCap ? C.yellow + '44' : C.bdr}` }}
                      title={isCap ? 'Remover capitão' : 'Definir como capitão'}>
                      <IcoStar size={14} color={isCap ? C.yellow : C.muted} fill={isCap} />
                    </button>
                    {/* Remove */}
                    <button onClick={() => removeAtleta(nome)}
                      className="flex items-center justify-center rounded-lg p-1.5"
                      style={{ background: '#f43f5e1a' }}>
                      <IcoBin size={13} color="#f43f5e" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </div>
  )
}

// ─── Time form ────────────────────────────────────────────────────────────────
function TimeForm({ initial, onSave, onBack }: { initial?: Partial<Time>; onSave: (t: Partial<Time>) => void; onBack: () => void }) {
  const { showToast, modalidades: MODALIDADES, atleticas: ATLETICAS, setAtleticas, audit } = useApp()
  const [nome, setNome]     = useState(initial?.nome ?? '')
  const [modId, setModId]   = useState(initial?.modalidadeId ?? '')
  const [isLorde, setIsLorde] = useState(initial?.atleticaId === undefined || initial.atleticaId === 'lorde')
  const [atleticaId, setAtleticaId] = useState(initial?.atleticaId ?? 'lorde')
  const [newAtl, setNewAtl] = useState(false)
  const [atlNome, setAtlNome] = useState('')
  const [atlCurso, setAtlCurso] = useState('')

  function save() {
    if (!nome || !modId) { showToast('Preencha nome e modalidade', 'error'); return }
    onSave({ nome, modalidadeId: modId, atleticaId: isLorde ? 'lorde' : atleticaId, atletas: initial?.atletas ?? [] })
    showToast('Time salvo!', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{initial?.nome ? 'Editar time' : 'Novo time'}</h3>
      </div>
      <div className="flex flex-col gap-4 px-4">
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Nome do time</label>
          <input value={nome} onChange={e => setNome(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
        </div>
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Modalidade</label>
          <div className="grid grid-cols-2 gap-2">
            {MODALIDADES.map(m => (
              <button key={m.id} onClick={() => setModId(m.id)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: modId === m.id ? m.cor + '22' : C.card2, border: `1px solid ${modId === m.id ? m.cor + '55' : C.bdr}` }}>
                <span className="text-lg">{m.emoji}</span>
                <span className="f-sora font-semibold text-sm" style={{ color: modId === m.id ? m.cor : C.text }}>{m.nome}</span>
                {modId === m.id && <IcoCheck size={12} color={m.cor} />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Atlética</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'lorde', label: 'Lorde (nossa)' }, { id: 'adversario', label: 'Adversária' }].map(opt => (
              <button key={opt.id} onClick={() => setIsLorde(opt.id === 'lorde')}
                className="py-2.5 rounded-xl f-sora font-semibold text-sm"
                style={{ background: (isLorde ? 'lorde' : 'adversario') === opt.id ? C.red : C.card2, color: (isLorde ? 'lorde' : 'adversario') === opt.id ? '#fff' : C.muted, border: `1px solid ${C.bdr}` }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!isLorde && (
          <div>
            <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Atlética adversária</label>
            {ATLETICAS.filter(a => a.id !== 'lorde').map(a => (
              <button key={a.id} onClick={() => setAtleticaId(a.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 text-left"
                style={{ background: atleticaId === a.id ? C.blue + '18' : C.card2, border: `1px solid ${atleticaId === a.id ? C.bdrB : C.bdr}` }}>
                <span className="f-sora font-semibold text-sm flex-1" style={{ color: C.text }}>{a.nome}</span>
                {atleticaId === a.id && <IcoCheck size={13} color={C.blueL} />}
              </button>
            ))}
            {newAtl ? (
              <div className="flex flex-col gap-2 mt-2">
                <input value={atlNome} onChange={e => setAtlNome(e.target.value)} placeholder="Nome da atlética"
                  className="w-full px-3 py-2.5 rounded-xl f-sora text-sm outline-none"
                  style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text }} />
                <input value={atlCurso} onChange={e => setAtlCurso(e.target.value)} placeholder="Curso"
                  className="w-full px-3 py-2.5 rounded-xl f-sora text-sm outline-none"
                  style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text }} />
                <button onClick={() => {
                  if (!atlNome.trim() || !atlCurso.trim()) return
                  const id = `atl-${Date.now()}`
                  setAtleticas(p => [...p, { id, nome: atlNome, curso: atlCurso }])
                  setAtleticaId(id)
                  setNewAtl(false)
                  audit('Times e elencos', 'Cadastrou atlética adversária', `${atlNome} · ${atlCurso}`)
                }} className="py-2 rounded-xl f-sora font-semibold text-xs" style={{ background: C.blue, color: '#fff' }}>Cadastrar atlética</button>
              </div>
            ) : (
              <button onClick={() => setNewAtl(true)} className="f-mono text-xs mt-2" style={{ color: C.blueL }}>+ Nova atlética</button>
            )}
          </div>
        )}
        <button onClick={save}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          Salvar time
        </button>
      </div>
    </div>
  )
}

// ─── Main TimesSection ────────────────────────────────────────────────────────
export default function TimesSection() {
  const {
    showToast, showConfirm, role, times, setTimes, modalidades, setModalidades,
    atleticas: ATLETICAS, eventos: EVENTOS, audit,
  } = useApp()
  const [tab, setTab] = useState<'modalidades' | 'times'>('times')
  const [filter, setFilter] = useState<'Lorde' | 'Adversários'>('Lorde')
  const [view, setView] = useState<'list' | 'form' | 'elenco'>('list')
  const [selectedTime, setSelectedTime] = useState<Time | null>(null)
  const [modForm, setModForm] = useState<Modalidade | null>(null)
  const [newMod, setNewMod] = useState(false)

  function toggleModAtivo(id: string) {
    const mod = modalidades.find(m => m.id === id)
    if (!mod) return
    setModalidades(p => p.map(m => m.id === id ? { ...m, ativa: !m.ativa } : m))
    audit('Modalidades', mod.ativa ? 'Desativou modalidade' : 'Ativou modalidade', mod.nome)
    showToast('Modalidade atualizada', 'success')
  }

  const displayTimes = times.filter(t => filter === 'Lorde' ? t.atleticaId === 'lorde' : t.atleticaId !== 'lorde')

  if (view === 'elenco' && selectedTime) {
    return <ElencoView time={selectedTime} onBack={() => setView('list')} />
  }
  if (view === 'form') {
    return (
      <TimeForm
        initial={selectedTime ?? undefined}
        onSave={data => {
          if (selectedTime) {
            setTimes(p => p.map(t => t.id === selectedTime.id ? { ...t, ...data } : t))
            audit('Times e elencos', 'Atualizou time', data.nome ?? selectedTime.nome)
          } else {
            setTimes(p => [...p, { ...data, id: `t${Date.now()}`, ativo: true } as Time])
            audit('Times e elencos', 'Criou time', data.nome ?? 'Novo time')
          }
        }}
        onBack={() => { setView('list'); setSelectedTime(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Tab */}
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {(['times', 'modalidades'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="py-2.5 f-sora font-semibold text-xs capitalize"
              style={{ background: tab === t ? C.red : 'transparent', color: tab === t ? '#fff' : C.muted }}>
              {t === 'times' ? '🏅 Times' : '🎮 Modalidades'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'modalidades' && (
        <div className="flex flex-col gap-2 px-4">
          {(newMod || modForm) && (
            <Card>
              <input value={modForm?.nome ?? ''} onChange={e => setModForm(p => ({ ...(p ?? { id: `mod-${Date.now()}`, emoji: '🏅', cor: C.red, ativa: true }), nome: e.target.value }))}
                placeholder="Nome da modalidade" className="w-full px-3 py-2 rounded-xl f-sora text-sm outline-none mb-2"
                style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text }} />
              <input value={modForm?.emoji ?? ''} onChange={e => setModForm(p => ({ ...(p ?? { id: `mod-${Date.now()}`, nome: '', cor: C.red, ativa: true }), emoji: e.target.value }))}
                placeholder="Ícone/emoji" className="w-full px-3 py-2 rounded-xl f-sora text-sm outline-none mb-2"
                style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text }} />
              <div className="flex gap-2">
                <button onClick={() => { setNewMod(false); setModForm(null) }} className="flex-1 py-2 rounded-xl f-sora text-xs" style={{ color: C.muted }}>Cancelar</button>
                <button onClick={() => {
                  if (!modForm?.nome.trim() || !modForm.emoji.trim()) return
                  const exists = modalidades.some(m => m.id === modForm.id)
                  setModalidades(p => exists ? p.map(m => m.id === modForm.id ? modForm : m) : [...p, modForm])
                  audit('Modalidades', exists ? 'Atualizou modalidade' : 'Criou modalidade', modForm.nome)
                  setModForm(null); setNewMod(false)
                }} className="flex-1 py-2 rounded-xl f-sora font-semibold text-xs" style={{ background: C.red, color: '#fff' }}>Salvar</button>
              </div>
            </Card>
          )}
          {!newMod && !modForm && <button onClick={() => { setNewMod(true); setModForm({ id: `mod-${Date.now()}`, nome: '', emoji: '🏅', cor: C.red, ativa: true }) }}
            className="w-full py-3 rounded-xl f-sora font-semibold text-sm" style={{ background: C.red, color: '#fff' }}>Nova modalidade</button>}
          {modalidades.map(m => {
            const count = times.filter(t => t.modalidadeId === m.id && t.atleticaId === 'lorde').length
            const linkedEvents = EVENTOS.some(e => times.find(t => t.id === e.timeLordeId)?.modalidadeId === m.id)
            return (
              <Card key={m.id} pad="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-2xl text-2xl shrink-0"
                    style={{ width: 50, height: 50, background: m.cor + '18', border: `1px solid ${m.cor}30` }}>
                    {m.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="f-sora font-bold text-sm" style={{ color: C.text }}>{m.nome}</div>
                    <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{count} times Lorde</div>
                    {!m.ativa && <div className="f-mono text-[9px]" style={{ color: C.yellow }}>Inativa</div>}
                  </div>
                  <button onClick={() => toggleModAtivo(m.id)}
                    className="rounded-full transition-all shrink-0"
                    style={{ width: 44, height: 24, background: m.ativa ? C.green : C.dim, padding: 3 }}>
                    <div className="rounded-full" style={{ width: 18, height: 18, background: '#fff', transform: `translateX(${m.ativa ? 20 : 0}px)` }} />
                  </button>
                  <button onClick={() => setModForm(m)} className="p-1.5 rounded-lg" style={{ background: C.blue + '22' }}><IcoEdit size={14} /></button>
                  {(role === 'presidente' || role === 'vice' || role === 'admin') && <button onClick={() => {
                    if (count > 0 || linkedEvents) { showToast('Esta modalidade possui vínculos e não pode ser excluída. Desative-a.', 'error'); return }
                    showConfirm('Excluir modalidade', `Excluir ${m.nome}?`, () => {
                      setModalidades(p => p.filter(x => x.id !== m.id))
                      audit('Modalidades', 'Excluiu modalidade', m.nome)
                    })
                  }} className="p-1.5 rounded-lg" style={{ background: '#f43f5e1a' }}><IcoBin size={14} color="#f43f5e" /></button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'times' && (
        <>
          <div className="flex gap-2 px-4">
            {(['Lorde', 'Adversários'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="flex-1 py-2 rounded-xl f-sora font-semibold text-xs"
                style={{ background: filter === f ? C.red : C.card, color: filter === f ? '#fff' : C.muted, border: `1px solid ${filter === f ? C.red : C.bdr}` }}>
                {f}
              </button>
            ))}
          </div>

          {displayTimes.length === 0
            ? <div className="px-4"><EmptyState message="Nenhum time encontrado" /></div>
            : (
              <div className="flex flex-col gap-2 px-4">
                {displayTimes.map(t => {
                  const mod = modalidades.find(m => m.id === t.modalidadeId)
                  const atl = ATLETICAS.find(a => a.id === t.atleticaId)
                  return (
                    <Card key={t.id} pad="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-xl text-xl shrink-0"
                          style={{ width: 44, height: 44, background: (mod?.cor ?? C.muted) + '18', border: `1px solid ${(mod?.cor ?? C.muted)}30` }}>
                          {mod?.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="f-sora font-bold text-sm" style={{ color: C.text }}>{t.nome}</div>
                          <div className="f-mono text-[10px]" style={{ color: C.muted }}>
                            {atl?.nome ?? t.atleticaId}
                            {t.atletas ? ` · ${t.atletas.length} atletas` : ''}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => {
                            setTimes(p => p.map(x => x.id === t.id ? { ...x, ativo: x.ativo === false } : x))
                            audit('Times e elencos', t.ativo === false ? 'Ativou time' : 'Desativou time', t.nome)
                          }} className="rounded-full shrink-0" style={{ width: 36, height: 20, background: t.ativo === false ? C.dim : C.green, padding: 2 }}>
                            <div className="rounded-full" style={{ width: 16, height: 16, background: '#fff', transform: `translateX(${t.ativo === false ? 0 : 16}px)` }} />
                          </button>
                          {filter === 'Lorde' && (
                            <button onClick={() => { setSelectedTime(t); setView('elenco') }}
                              className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.green + '18' }}>
                              <IcoCheck size={14} color={C.green} />
                            </button>
                          )}
                          <button onClick={() => { setSelectedTime(t); setView('form') }}
                            className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.blue + '22' }}>
                            <IcoEdit size={14} />
                          </button>
                          {(role === 'presidente' || role === 'vice' || role === 'admin') && <button onClick={() => {
                            if (EVENTOS.some(e => e.timeLordeId === t.id || e.timeAdvId === t.id)) { showToast('Este time possui eventos e não pode ser excluído. Desative-o.', 'error'); return }
                            showConfirm('Excluir time', `Excluir ${t.nome}?`, () => {
                              setTimes(p => p.filter(x => x.id !== t.id))
                              audit('Times e elencos', 'Excluiu time', t.nome)
                            })
                          }} className="p-1.5 rounded-lg" style={{ background: '#f43f5e1a' }}><IcoBin size={14} color="#f43f5e" /></button>}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}

          <div className="px-4">
            <button onClick={() => { setSelectedTime(null); setView('form') }}
              className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
              <IcoPlus size={14} color={C.blueL} /> Novo time
            </button>
          </div>
        </>
      )}
    </div>
  )
}
