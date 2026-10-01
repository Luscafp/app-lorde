import { useState } from 'react'
import { C } from '../theme'
import { initials, getMeByRole } from '../utils'
import { Card, Chip, Av, SH, IcoBack, IcoChev, IcoStar, IcoPlus, IcoCheck, IcoX, IcoAlert } from '../components/atoms'
import { EmptyState } from '../components/shared'
import { useApp } from '../AppContext'
import type { Time, Modalidade } from '../types'

type JoinState = 'none' | 'confirming' | 'pendente' | 'membro' | 'leaving' | 'cancelling'

function ConfirmSheet({ title, message, confirmLabel, confirmColor = C.red, onConfirm, onCancel }:
  { title: string; message: string; confirmLabel: string; confirmColor?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-6 a-up"
        style={{ background: C.card, border: `1px solid ${C.bdr}`, boxShadow: '0 -16px 40px rgba(0,0,0,.5)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center rounded-2xl"
            style={{ width: 44, height: 44, background: confirmColor + '1a', border: `1px solid ${confirmColor}33` }}>
            <IcoAlert size={22} color={confirmColor} />
          </div>
          <h3 className="f-sora font-black text-lg" style={{ color: C.text }}>{title}</h3>
        </div>
        <p className="f-mono text-sm mb-6 leading-relaxed" style={{ color: C.muted }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
            style={{ background: confirmColor, color: '#fff', boxShadow: `0 4px 16px ${confirmColor}44` }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function TimeDetail({ time, mod, onBack }: { time: Time; mod: Modalidade; onBack: () => void }) {
  const { showToast, eventos, role, solicitacoes, setSolicitacoes } = useApp()
  const me = getMeByRole(role)
  const existingRequest = solicitacoes.find(s => s.usuarioId === me.id && s.timeId === time.id)
  const initialJoin: JoinState = existingRequest?.status === 'PENDENTE'
    ? 'pendente'
    : existingRequest?.status === 'APROVADA' || time.atletas?.includes(me.nome)
      ? 'membro'
      : 'none'
  const [join, setJoin] = useState<JoinState>(initialJoin)

  function handleSolicitar() { setJoin('confirming') }
  function handleConfirmSolicitar() {
    setJoin('pendente')
    setSolicitacoes(p => [...p, {
      id: `sol-${Date.now()}`,
      usuarioId: me.id,
      nomeUsuario: me.nome,
      timeId: time.id,
      status: 'PENDENTE',
      data: new Date().toISOString(),
    }])
    showToast('Solicitação enviada!', 'success')
  }
  function handleCancelar() { setJoin('cancelling') }
  function handleConfirmCancelar() {
    setJoin('none')
    setSolicitacoes(p => p.map(s => s.usuarioId === me.id && s.timeId === time.id && s.status === 'PENDENTE'
      ? { ...s, status: 'CANCELADA' }
      : s))
    showToast('Solicitação cancelada', 'error')
  }
  function handleSair() { setJoin('leaving') }
  function handleConfirmSair() {
    setJoin('none')
    showToast('Você saiu do time', 'error')
  }

  const nextTreinos = eventos
    .filter(e => e.timeLordeId === time.id && e.tipo === 'TREINO' && e.status === 'Agendado')
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 4)
    .map(e => ({ data: e.inicio, local: e.local }))
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

  return (
    <div className="flex flex-col gap-4 pb-6 a-up relative">
      {/* Back */}
      <div className="px-4 pt-5 flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
          <IcoBack />
        </button>
        <h2 className="f-sora font-black text-lg" style={{ color: C.text }}>{time.nome}</h2>
      </div>

      {/* Hero */}
      <div className="mx-4 rounded-2xl p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg,${mod.cor}28 0%,${C.card} 100%)`, border: `1px solid ${mod.cor}30` }}>
        <div className="absolute right-3 top-3 text-6xl opacity-10">{mod.emoji}</div>
        <div className="text-4xl mb-2">{mod.emoji}</div>
        <h3 className="f-sora font-black text-2xl text-white mb-1">{time.nome}</h3>
        <p className="f-mono text-[10px] mb-3" style={{ color: C.muted }}>{mod.nome}</p>
        <div className="flex flex-wrap gap-4">
          {time.treino && (
            <div>
              <div className="f-mono text-[9px] uppercase" style={{ color: C.muted }}>Treinos</div>
              <div className="f-sora font-semibold text-sm text-white">{time.treino}</div>
            </div>
          )}
          {time.local && (
            <div>
              <div className="f-mono text-[9px] uppercase" style={{ color: C.muted }}>Local</div>
              <div className="f-sora font-semibold text-sm text-white">{time.local}</div>
            </div>
          )}
        </div>
      </div>

      {/* Status badge when member or pending */}
      {join === 'membro' && (
        <div className="mx-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: C.green + '18', border: `1px solid ${C.green}33` }}>
          <IcoCheck size={16} color={C.green} />
          <span className="f-sora font-semibold text-sm" style={{ color: C.green }}>Você faz parte deste time</span>
        </div>
      )}
      {join === 'pendente' && (
        <div className="mx-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: C.yellow + '18', border: `1px solid ${C.yellow}33` }}>
          <span className="f-mono text-sm">⏳</span>
          <span className="f-sora font-semibold text-sm" style={{ color: C.yellow }}>Solicitação pendente de aprovação</span>
        </div>
      )}

      {/* Capitão */}
      {time.capitao && (
        <div className="px-4">
          <div className="f-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: C.muted }}>Capitão/ã</div>
          <Card pad="p-3">
            <div className="flex items-center gap-3">
              <Av s={initials(time.capitao)} size={46} bg={`linear-gradient(135deg,${mod.cor},${mod.cor}88)`} />
              <div className="flex-1">
                <div className="f-sora font-bold text-base text-white">{time.capitao}</div>
                <div className="f-mono text-[10px] mt-px" style={{ color: mod.cor }}>Capitão/ã · {time.nome}</div>
              </div>
              <IcoStar size={18} />
            </div>
          </Card>
        </div>
      )}

      {/* Elenco */}
      {time.atletas && time.atletas.length > 0 && (
        <div className="px-4">
          <SH title="Elenco" sub={`${time.atletas.length} atletas`} />
          <div className="flex flex-col gap-1.5">
            {time.atletas.map((a, i) => (
              <Card key={a} pad="p-3">
                <div className="flex items-center gap-3">
                  <span className="f-mono text-[10px] text-right shrink-0" style={{ color: C.dim, width: 20 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Av s={initials(a)} size={32} bg={a === time.capitao ? `linear-gradient(135deg,${mod.cor},${mod.cor}88)` : C.card2} />
                  <span className="f-sora font-medium text-sm flex-1" style={{ color: C.text }}>{a}</span>
                  {a === time.capitao && <IcoStar size={14} />}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Próximos treinos */}
      {time.treino && (
        <div className="px-4">
          <SH title="Próximos treinos" />
          <div className="flex flex-col gap-2">
            {nextTreinos.map((t, i) => {
              const d = new Date(t.data)
              return (
                <Card key={i} pad="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center rounded-xl shrink-0"
                      style={{ width: 44, height: 44, background: mod.cor + '18', border: `1px solid ${mod.cor}33` }}>
                      <span className="f-sora font-black text-sm leading-none" style={{ color: mod.cor }}>
                        {d.getDate()}
                      </span>
                      <span className="f-mono text-[9px]" style={{ color: C.muted }}>
                        {DIAS[d.getDay()].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>
                        {d.getHours().toString().padStart(2, '0')}:{d.getMinutes().toString().padStart(2, '0')} · Treino
                      </div>
                      <div className="f-mono text-[10px]" style={{ color: C.muted }}>{t.local}</div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <div className="px-4 flex flex-col gap-2">
        {join === 'none' && (
          <button onClick={handleSolicitar}
            className="w-full py-4 rounded-2xl f-sora font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg,${mod.cor},${mod.cor}cc)`, color: '#fff', boxShadow: `0 4px 20px ${mod.cor}44` }}>
            <IcoPlus size={18} /> Solicitar entrada no time
          </button>
        )}
        {join === 'pendente' && (
          <button onClick={handleCancelar}
            className="w-full py-4 rounded-2xl f-sora font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: C.yellow + '1a', color: C.yellow, border: `1px solid ${C.yellow}44` }}>
            <IcoX size={16} color={C.yellow} /> Cancelar solicitação
          </button>
        )}
        {join === 'membro' && (
          <button onClick={handleSair}
            className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#f43f5e1a', color: '#f43f5e', border: '1px solid rgba(244,63,94,.3)' }}>
            <IcoX size={14} color="#f43f5e" /> Sair do time
          </button>
        )}
      </div>

      {/* Confirm sheets */}
      {join === 'confirming' && (
        <ConfirmSheet
          title="Solicitar entrada"
          message={`Deseja enviar uma solicitação para entrar no ${time.nome}? A diretoria irá analisar e aprovar ou rejeitar.`}
          confirmLabel="Enviar solicitação"
          confirmColor={mod.cor}
          onConfirm={() => { setJoin('pendente'); handleConfirmSolicitar() }}
          onCancel={() => setJoin('none')}
        />
      )}
      {join === 'cancelling' && (
        <ConfirmSheet
          title="Cancelar solicitação"
          message="Tem certeza que deseja cancelar sua solicitação de entrada no time?"
          confirmLabel="Cancelar solicitação"
          confirmColor={C.yellow}
          onConfirm={handleConfirmCancelar}
          onCancel={() => setJoin('pendente')}
        />
      )}
      {join === 'leaving' && (
        <ConfirmSheet
          title="Sair do time"
          message={`Tem certeza que deseja sair do ${time.nome}? Você precisará solicitar entrada novamente para voltar.`}
          confirmLabel="Sair do time"
          confirmColor="#f43f5e"
          onConfirm={handleConfirmSair}
          onCancel={() => setJoin('membro')}
        />
      )}
    </div>
  )
}

export default function ModalidadesScreen() {
  const { times: TIMES, modalidades: MODALIDADES } = useApp()
  const [selected, setSelected] = useState<{ time: Time; mod: Modalidade } | null>(null)
  const [fMod, setFMod] = useState<string | null>(null)

  if (selected) {
    return <TimeDetail time={selected.time} mod={selected.mod} onBack={() => setSelected(null)} />
  }

  const activeMods = MODALIDADES.filter(m => m.ativa)
  const lordeTimes = TIMES.filter(t => t.atleticaId === 'lorde' && t.ativo !== false && activeMods.some(m => m.id === t.modalidadeId))
  const displayed  = fMod ? lordeTimes.filter(t => t.modalidadeId === fMod) : lordeTimes

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      <div className="px-4 pt-5">
        <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>Times</h2>
        <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>
          {lordeTimes.length} times em competição
        </p>
      </div>

      <div className="flex gap-2 px-4 overflow-x-auto pb-1">
        <button onClick={() => setFMod(null)}
          className="shrink-0 rounded-full font-semibold text-xs transition-all px-3 py-1.5"
          style={{ background: fMod === null ? C.red : C.card, color: fMod === null ? '#fff' : C.muted, border: `1px solid ${fMod === null ? C.red : C.bdr}` }}>
          Todos
        </button>
        {activeMods.map(m => (
          <button key={m.id} onClick={() => setFMod(fMod === m.id ? null : m.id)}
            className="shrink-0 flex items-center gap-1.5 rounded-full font-semibold text-xs transition-all px-3 py-1.5"
            style={{ background: fMod === m.id ? m.cor : C.card, color: fMod === m.id ? '#fff' : C.muted, border: `1px solid ${fMod === m.id ? m.cor : C.bdr}` }}>
            {m.emoji} {m.nome}
          </button>
        ))}
      </div>

      {displayed.length === 0
        ? <EmptyState icon={<span className="text-4xl opacity-40">🏅</span>} message="Nenhum time encontrado" action="Ver todos" onAction={() => setFMod(null)} />
        : (
          <div className="flex flex-col gap-2.5 px-4">
            {displayed.map(t => {
              const mod = MODALIDADES.find(m => m.id === t.modalidadeId)!
              return (
                <Card key={t.id} onClick={() => setSelected({ time: t, mod })} pad="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-2xl shrink-0 text-2xl"
                      style={{ width: 52, height: 52, background: mod.cor + '1a', border: `1px solid ${mod.cor}30` }}>
                      {mod.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="f-sora font-bold text-base" style={{ color: C.text }}>{t.nome}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>
                        {t.capitao ? `Cap. ${t.capitao.split(' ')[0]}` : '—'}
                        {t.atletas ? ` · ${t.atletas.length} atletas` : ''}
                      </div>
                      {t.treino && <div className="f-mono text-[10px] mt-px" style={{ color: mod.cor }}>{t.treino}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <IcoChev />
                      <Chip label={mod.nome} color={mod.cor} />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </div>
  )
}
