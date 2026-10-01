import { useState } from 'react'
import { C, ATLETICA } from '../../theme'
import { initials, canDelete } from '../../utils'
import { elencoIds, encerrarVinculo } from '../../domain'
import { Card, Chip, Av, IcoBack, IcoPlus, IcoCheck, IcoBin, IcoEdit, IcoStar, IcoUsers } from '../../components/atoms'
import { EmptyState, Field } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Time, Modalidade } from '../../types'

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={on ? 'Ativo — toque para desativar' : 'Inativo — toque para ativar'}
      className="rounded-full shrink-0" style={{ width: 36, height: 20, background: on ? C.green : C.dim, padding: 2 }}>
      <div className="rounded-full transition-all" style={{ width: 16, height: 16, background: '#fff', transform: `translateX(${on ? 16 : 0}px)` }} />
    </button>
  )
}

// ─── Elenco e capitão (UC19 passo 4) ──────────────────────────────────────────
function ElencoView({ timeId, onBack, onVerSolicitacoes }: { timeId: string; onBack: () => void; onVerSolicitacoes: () => void }) {
  const { times, setTimes, membros, setMembros, modalidades, solicitacoes, showToast, showConfirm, audit, online, nomeUsuario } = useApp()
  const time = times.find(t => t.id === timeId)
  if (!time) return null
  const mod = modalidades.find(m => m.id === time.modalidadeId)
  const elenco = elencoIds(membros, time.id).sort((a, b) => nomeUsuario(a).localeCompare(nomeUsuario(b)))
  const pendentes = solicitacoes.filter(s => s.timeId === time.id && s.status === 'PENDENTE').length

  function remover(id: string) {
    showConfirm('Remover do elenco', `Remover ${nomeUsuario(id)} do elenco do ${time!.nome}?`, () => {
      if (!online()) return
      setMembros(p => encerrarVinculo(p, id, time!.id))
      // RN23: capitão precisa estar no elenco
      if (time!.capitaoId === id) setTimes(p => p.map(t => t.id === time!.id ? { ...t, capitaoId: undefined } : t))
      audit('Times e elencos', 'Removeu atleta do elenco', `${nomeUsuario(id)} · ${time!.nome}`)
      showToast('Atleta removido do elenco', 'success')
    }, 'Remover')
  }

  function definirCapitao(id: string) {
    if (!online()) return
    const remover = time!.capitaoId === id
    // RN22: no máximo um capitão — definir um novo substitui o anterior
    setTimes(p => p.map(t => t.id === time!.id ? { ...t, capitaoId: remover ? undefined : id } : t))
    audit('Times e elencos', remover ? 'Removeu capitão' : 'Definiu capitão', `${nomeUsuario(id)} · ${time!.nome}`)
    showToast(remover ? 'Capitão removido' : `${nomeUsuario(id).split(' ')[0]} é o novo capitão`, 'success')
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <div>
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Elenco — {time.nome}</h3>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{mod?.emoji} {mod?.nome} · {elenco.length} atletas</p>
        </div>
      </div>

      <button onClick={onVerSolicitacoes}
        className="mx-4 flex items-center justify-between px-3 py-2.5 rounded-xl f-mono text-[10px]"
        style={{ color: C.yellow, background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
        <span>Solicitações pendentes deste time ({pendentes})</span>
        <span>→</span>
      </button>
      <p className="mx-4 f-mono text-[10px]" style={{ color: C.dim }}>
        Atletas entram no elenco quando a solicitação de entrada é aprovada. Toque na estrela para definir o capitão.
      </p>

      {elenco.length === 0
        ? <div className="px-4"><EmptyState message="Elenco vazio" /></div>
        : (
          <div className="flex flex-col gap-2 px-4">
            {elenco.map(id => {
              const isCap = time.capitaoId === id
              return (
                <Card key={id} pad="p-3">
                  <div className="flex items-center gap-3">
                    <Av s={initials(nomeUsuario(id))} size={36} bg={isCap ? `linear-gradient(135deg,${mod?.cor ?? C.red},${mod?.cor ?? C.red}88)` : C.card2} />
                    <div className="flex-1 min-w-0">
                      <span className="f-sora font-medium text-sm" style={{ color: C.text }}>{nomeUsuario(id)}</span>
                      {isCap && <div><Chip label="CAPITÃO" color={C.yellow} /></div>}
                    </div>
                    <button onClick={() => definirCapitao(id)}
                      className="flex items-center justify-center rounded-lg p-1.5"
                      style={{ background: isCap ? C.yellow + '22' : C.card2, border: `1px solid ${isCap ? C.yellow + '44' : C.bdr}` }}
                      title={isCap ? 'Remover capitão' : 'Definir como capitão'}>
                      <IcoStar size={14} color={isCap ? C.yellow : C.muted} fill={isCap} />
                    </button>
                    <button onClick={() => remover(id)} title="Remover do elenco"
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

// ─── Formulário de time (UC19 passo 3) ────────────────────────────────────────
function TimeForm({ initial, onBack }: { initial?: Time; onBack: () => void }) {
  const { showToast, modalidades, atleticas, setAtleticas, setTimes, audit, online } = useApp()
  const [nome, setNome]     = useState(initial?.nome ?? '')
  const [modId, setModId]   = useState(initial?.modalidadeId ?? '')
  const [atleticaId, setAtleticaId] = useState(initial?.atleticaId ?? ATLETICA.id)
  const [newAtl, setNewAtl] = useState(false)
  const [atlNome, setAtlNome] = useState('')
  const [atlCurso, setAtlCurso] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nossa = atleticaId === ATLETICA.id
  const adversarias = atleticas.filter(a => a.id !== ATLETICA.id)

  function save() {
    const e: Record<string, string> = {}
    if (!nome.trim()) e.nome = 'Informe o nome do time'
    if (!modId) e.mod = 'Escolha a modalidade'
    if (!atleticaId) e.atl = 'Escolha a atlética'
    setErrors(e)
    if (Object.keys(e).length || !online()) return
    if (initial) {
      setTimes(p => p.map(t => t.id === initial.id ? { ...t, nome: nome.trim(), modalidadeId: modId, atleticaId } : t))
      audit('Times e elencos', 'Editou time', nome.trim())
    } else {
      setTimes(p => [...p, { id: `t${Date.now()}`, nome: nome.trim(), modalidadeId: modId, atleticaId, ativo: true }])
      audit('Times e elencos', 'Criou time', `${nome.trim()} · ${atleticas.find(a => a.id === atleticaId)?.nome}`)
    }
    showToast('Time salvo', 'success')
    onBack()
  }

  function cadastrarAtletica() {
    if (!atlNome.trim() || !atlCurso.trim() || !online()) return
    const id = `atl-${Date.now()}`
    setAtleticas(p => [...p, { id, nome: atlNome.trim(), curso: atlCurso.trim(), usaAplicativo: false }])
    setAtleticaId(id)
    setNewAtl(false); setAtlNome(''); setAtlCurso('')
    audit('Times e elencos', 'Cadastrou atlética adversária', atlNome.trim())
    showToast('Atlética cadastrada', 'success')
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{initial ? 'Editar time' : 'Novo time'}</h3>
      </div>
      <div className="flex flex-col gap-4 px-4">
        <Field label="Nome do time" value={nome} onChange={setNome} placeholder="Ex.: Futsal Masculino" error={errors.nome} />
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Modalidade</label>
          <div className="grid grid-cols-2 gap-2">
            {modalidades.map(m => (
              <button key={m.id} onClick={() => setModId(m.id)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: modId === m.id ? m.cor + '22' : C.card2, border: `1px solid ${modId === m.id ? m.cor + '55' : C.bdr}`, opacity: m.ativa ? 1 : .5 }}>
                <span className="text-lg">{m.emoji}</span>
                <span className="f-sora font-semibold text-sm" style={{ color: modId === m.id ? m.cor : C.text }}>{m.nome}</span>
                {modId === m.id && <IcoCheck size={12} color={m.cor} />}
              </button>
            ))}
          </div>
          {errors.mod && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{errors.mod}</p>}
        </div>
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Atlética</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'nossa', label: ATLETICA.nome }, { id: 'adversaria', label: 'Adversária' }].map(opt => {
              const ativo = (nossa ? 'nossa' : 'adversaria') === opt.id
              return (
                <button key={opt.id} onClick={() => setAtleticaId(opt.id === 'nossa' ? ATLETICA.id : (adversarias[0]?.id ?? ''))}
                  className="py-2.5 rounded-xl f-sora font-semibold text-sm"
                  style={{ background: ativo ? C.red : C.card2, color: ativo ? '#fff' : C.muted, border: `1px solid ${C.bdr}` }}>
                  {opt.label}
                </button>
              )
            })}
          </div>
          {!nossa && <p className="f-mono text-[10px] mt-2" style={{ color: C.dim }}>Times adversários não têm elenco, capitão nem treinos.</p>}
        </div>
        {!nossa && (
          <div>
            <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Atlética adversária</label>
            {adversarias.map(a => (
              <button key={a.id} onClick={() => setAtleticaId(a.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 text-left"
                style={{ background: atleticaId === a.id ? C.blue + '18' : C.card2, border: `1px solid ${atleticaId === a.id ? C.bdrB : C.bdr}` }}>
                <div className="flex-1">
                  <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{a.nome}</span>
                  <div className="f-mono text-[9px]" style={{ color: C.muted }}>{a.curso}</div>
                </div>
                {atleticaId === a.id && <IcoCheck size={13} color={C.blueL} />}
              </button>
            ))}
            {newAtl ? (
              <div className="flex flex-col gap-2 mt-2">
                <Field label="Nome da atlética" value={atlNome} onChange={setAtlNome} />
                <Field label="Curso" value={atlCurso} onChange={setAtlCurso} />
                <button onClick={cadastrarAtletica} className="py-2 rounded-xl f-sora font-semibold text-xs" style={{ background: C.blue, color: '#fff' }}>Cadastrar atlética</button>
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

// ─── Modalidade: novo/editar (nome e ícone) ───────────────────────────────────
function ModalidadeForm({ initial, onClose }: { initial?: Modalidade; onClose: () => void }) {
  const { setModalidades, audit, showToast, online } = useApp()
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🏅')

  function salvar() {
    if (!nome.trim() || !emoji.trim() || !online()) return
    if (initial) setModalidades(p => p.map(m => m.id === initial.id ? { ...m, nome: nome.trim(), emoji: emoji.trim() } : m))
    else setModalidades(p => [...p, { id: `mod-${Date.now()}`, nome: nome.trim(), emoji: emoji.trim(), cor: C.red, ativa: true }])
    audit('Modalidades', initial ? 'Editou modalidade' : 'Criou modalidade', nome.trim())
    showToast('Modalidade salva', 'success')
    onClose()
  }

  return (
    <Card>
      <p className="f-sora font-bold text-sm mb-3" style={{ color: C.text }}>{initial ? 'Editar modalidade' : 'Nova modalidade'}</p>
      <div className="grid grid-cols-[1fr_80px] gap-2 mb-3">
        <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Xadrez" />
        <Field label="Ícone" value={emoji} onChange={setEmoji} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 rounded-xl f-sora text-xs" style={{ color: C.muted, border: `1px solid ${C.bdr}` }}>Cancelar</button>
        <button onClick={salvar} disabled={!nome.trim()} className="flex-1 py-2 rounded-xl f-sora font-semibold text-xs"
          style={{ background: nome.trim() ? C.red : C.dim, color: '#fff' }}>Salvar</button>
      </div>
    </Card>
  )
}

// ─── Seção Times e Modalidades (UC19) ─────────────────────────────────────────
export default function TimesSection({ onVerSolicitacoes }: { onVerSolicitacoes: () => void }) {
  const {
    role, times, setTimes, modalidades, setModalidades, atleticas, eventos, membros,
    showToast, showConfirm, audit, online,
  } = useApp()
  const [tab, setTab] = useState<'times' | 'modalidades'>('times')
  const [filter, setFilter] = useState<'nossa' | 'adversarias'>('nossa')
  const [view, setView] = useState<'list' | 'form' | 'elenco'>('list')
  const [selId, setSelId] = useState<string | null>(null)
  const [modForm, setModForm] = useState<Modalidade | 'novo' | null>(null)
  const podeExcluir = canDelete(role)

  const selected = selId ? times.find(t => t.id === selId) : undefined

  function toggleMod(m: Modalidade) {
    if (!online()) return
    setModalidades(p => p.map(x => x.id === m.id ? { ...x, ativa: !x.ativa } : x))
    audit('Modalidades', m.ativa ? 'Desativou modalidade' : 'Ativou modalidade', m.nome)
    showToast(m.ativa ? `${m.nome} desativada — some das telas do atleta` : `${m.nome} ativada`, 'success')
  }

  function excluirMod(m: Modalidade) {
    const vinculada = times.some(t => t.modalidadeId === m.id) ||
      eventos.some(e => times.find(t => t.id === e.timeId)?.modalidadeId === m.id)
    if (vinculada) { showToast('Esta modalidade possui vínculos e não pode ser excluída. Desative-a.', 'error'); return }
    showConfirm('Excluir modalidade', `Excluir ${m.nome}?`, () => {
      if (!online()) return
      setModalidades(p => p.filter(x => x.id !== m.id))
      audit('Modalidades', 'Excluiu modalidade', m.nome)
      showToast('Modalidade excluída', 'success')
    }, 'Excluir')
  }

  function toggleTime(t: Time) {
    if (!online()) return
    setTimes(p => p.map(x => x.id === t.id ? { ...x, ativo: !x.ativo } : x))
    audit('Times e elencos', t.ativo ? 'Desativou time' : 'Ativou time', t.nome)
    showToast(t.ativo ? `${t.nome} desativado` : `${t.nome} ativado`, 'success')
  }

  function excluirTime(t: Time) {
    if (eventos.some(e => e.timeId === t.id || e.timeAdversarioId === t.id)) {
      showToast('Este time possui eventos e não pode ser excluído. Desative-o.', 'error'); return
    }
    showConfirm('Excluir time', `Excluir ${t.nome}?`, () => {
      if (!online()) return
      setTimes(p => p.filter(x => x.id !== t.id))
      audit('Times e elencos', 'Excluiu time', t.nome)
      showToast('Time excluído', 'success')
    }, 'Excluir')
  }

  if (view === 'elenco' && selected) {
    return <ElencoView timeId={selected.id} onBack={() => setView('list')} onVerSolicitacoes={onVerSolicitacoes} />
  }
  if (view === 'form') {
    return <TimeForm initial={selected} onBack={() => { setView('list'); setSelId(null) }} />
  }

  const lista = times.filter(t => filter === 'nossa' ? t.atleticaId === ATLETICA.id : t.atleticaId !== ATLETICA.id)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {(['times', 'modalidades'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="py-2.5 f-sora font-semibold text-xs"
              style={{ background: tab === t ? C.red : 'transparent', color: tab === t ? '#fff' : C.muted }}>
              {t === 'times' ? '🏅 Times' : '🎮 Modalidades'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'modalidades' && (
        <div className="flex flex-col gap-2 px-4">
          <p className="f-mono text-[10px]" style={{ color: C.dim }}>Modalidade é o esporte; time é o grupo de pessoas. Modalidades inativas somem das telas do atleta.</p>
          {modForm
            ? <ModalidadeForm initial={modForm === 'novo' ? undefined : modForm} onClose={() => setModForm(null)} />
            : <button onClick={() => setModForm('novo')}
                className="w-full py-3 rounded-xl f-sora font-semibold text-sm flex items-center justify-center gap-2" style={{ background: C.red, color: '#fff' }}>
                <IcoPlus size={14} /> Nova modalidade
              </button>}
          {modalidades.map(m => {
            const n = times.filter(t => t.modalidadeId === m.id && t.atleticaId === ATLETICA.id).length
            return (
              <Card key={m.id} pad="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-2xl text-2xl shrink-0"
                    style={{ width: 46, height: 46, background: m.cor + '18', border: `1px solid ${m.cor}30`, opacity: m.ativa ? 1 : .5 }}>
                    {m.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="f-sora font-bold text-sm" style={{ color: C.text }}>{m.nome}</div>
                    <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{n} times da {ATLETICA.sigla}</div>
                    {!m.ativa && <Chip label="INATIVA" color={C.yellow} />}
                  </div>
                  <Switch on={m.ativa} onClick={() => toggleMod(m)} />
                  <button onClick={() => setModForm(m)} className="p-1.5 rounded-lg" style={{ background: C.blue + '22' }} title="Editar"><IcoEdit size={14} /></button>
                  {podeExcluir && (
                    <button onClick={() => excluirMod(m)} className="p-1.5 rounded-lg" style={{ background: '#f43f5e1a' }} title="Excluir">
                      <IcoBin size={14} color="#f43f5e" />
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'times' && (
        <>
          <div className="flex gap-2 px-4">
            {([['nossa', ATLETICA.sigla], ['adversarias', 'Adversários']] as const).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className="flex-1 py-2 rounded-xl f-sora font-semibold text-xs"
                style={{ background: filter === f ? C.red : C.card, color: filter === f ? '#fff' : C.muted, border: `1px solid ${filter === f ? C.red : C.bdr}` }}>
                {label}
              </button>
            ))}
          </div>

          <div className="px-4">
            <button onClick={() => { setSelId(null); setView('form') }}
              className="w-full py-3 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
              <IcoPlus size={14} color={C.blueL} /> Novo time
            </button>
          </div>

          {lista.length === 0
            ? <div className="px-4"><EmptyState message="Nenhum time encontrado" /></div>
            : (
              <div className="flex flex-col gap-2 px-4">
                {lista.map(t => {
                  const mod = modalidades.find(m => m.id === t.modalidadeId)
                  const atl = atleticas.find(a => a.id === t.atleticaId)
                  const nossa = t.atleticaId === ATLETICA.id
                  return (
                    <Card key={t.id} pad="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-xl text-xl shrink-0"
                          style={{ width: 42, height: 42, background: (mod?.cor ?? C.muted) + '18', border: `1px solid ${(mod?.cor ?? C.muted)}30`, opacity: t.ativo ? 1 : .5 }}>
                          {mod?.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="f-sora font-bold text-sm truncate" style={{ color: C.text }}>{t.nome}</div>
                          <div className="f-mono text-[10px] truncate" style={{ color: C.muted }}>
                            {nossa ? `${elencoIds(membros, t.id).length} atletas` : atl?.nome}
                          </div>
                          {!t.ativo && <Chip label="INATIVO" color={C.yellow} />}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Switch on={t.ativo} onClick={() => toggleTime(t)} />
                          {nossa && (
                            <button onClick={() => { setSelId(t.id); setView('elenco') }} title="Elenco e capitão"
                              className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.green + '18' }}>
                              <IcoUsers size={14} color={C.green} />
                            </button>
                          )}
                          <button onClick={() => { setSelId(t.id); setView('form') }} title="Editar"
                            className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.blue + '22' }}>
                            <IcoEdit size={14} />
                          </button>
                          {podeExcluir && (
                            <button onClick={() => excluirTime(t)} title="Excluir"
                              className="p-1.5 rounded-lg" style={{ background: '#f43f5e1a' }}>
                              <IcoBin size={14} color="#f43f5e" />
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
        </>
      )}
    </div>
  )
}
