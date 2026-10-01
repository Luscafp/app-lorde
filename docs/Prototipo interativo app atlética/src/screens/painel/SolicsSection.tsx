import { useState } from 'react'
import { C } from '../../theme'
import { fmtDate, initials } from '../../utils'
import { Card, Chip, Av, IcoCheck, IcoX, IcoAlert } from '../../components/atoms'
import { EmptyState } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Solicitacao } from '../../types'

function ConfirmSheet({ title, msg, confirmLabel, confirmColor = C.red, onOk, onCancel }:
  { title: string; msg: string; confirmLabel: string; confirmColor?: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-5 a-up" style={{ background: C.card, border: `1px solid ${C.bdr}`, maxWidth: 390, margin: '0 auto' }}>
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

export default function SolicsSection() {
  const {
    showToast, solicitacoes: solics, setSolicitacoes: setSolics,
    times: TIMES, setTimes, modalidades: MODALIDADES, audit,
  } = useApp()
  const [tab, setTab] = useState<'pendentes' | 'historico'>('pendentes')
  const [confirm, setConfirm] = useState<{ id: string; dec: 'APROVADA' | 'REJEITADA' } | null>(null)

  const pendentes  = solics.filter(s => s.status === 'PENDENTE')
  const historico  = solics.filter(s => s.status !== 'PENDENTE')
  const displayed  = tab === 'pendentes' ? pendentes : historico

  function decide(id: string, dec: 'APROVADA' | 'REJEITADA') {
    const solic = solics.find(s => s.id === id)
    setSolics(p => p.map(s => s.id === id ? { ...s, status: dec } : s))
    if (dec === 'APROVADA' && solic) {
      setTimes(p => p.map(t => t.id === solic.timeId && !(t.atletas ?? []).includes(solic.nomeUsuario)
        ? { ...t, atletas: [...(t.atletas ?? []), solic.nomeUsuario] }
        : t))
    }
    if (solic) audit('Solicitações', dec === 'APROVADA' ? 'Aprovou solicitação e adicionou ao elenco' : 'Rejeitou solicitação', solic.nomeUsuario)
    showToast(dec === 'APROVADA' ? 'Solicitação aceita!' : 'Solicitação rejeitada', dec === 'APROVADA' ? 'success' : 'error')
    setConfirm(null)
  }

  return (
    <div className="flex flex-col gap-4 pb-4 relative">
      {/* Tabs */}
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {([
            { id: 'pendentes' as const, label: `Pendentes${pendentes.length > 0 ? ` (${pendentes.length})` : ''}` },
            { id: 'historico'  as const, label: 'Histórico' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="py-2.5 f-sora font-semibold text-xs"
              style={{ background: tab === t.id ? C.red : 'transparent', color: tab === t.id ? '#fff' : C.muted }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 px-4">
        {displayed.length === 0
          ? <EmptyState message={tab === 'pendentes' ? 'Nenhuma solicitação pendente 🎉' : 'Nenhum histórico ainda'} />
          : displayed.map(s => {
            const time = TIMES.find(t => t.id === s.timeId)
            const mod  = MODALIDADES.find(m => m.id === time?.modalidadeId)
            return (
              <Card key={s.id} pad="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <Av s={initials(s.nomeUsuario)} size={44}
                      bg={s.status === 'APROVADA' ? C.green : s.status === 'REJEITADA' ? '#f43f5e88' : C.blue} />
                    <div>
                      <div className="f-sora font-bold text-sm" style={{ color: C.text }}>{s.nomeUsuario}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{fmtDate(s.data)}</div>
                    </div>
                  </div>
                  <Chip
                    label={s.status}
                    color={s.status === 'PENDENTE' ? C.yellow : s.status === 'APROVADA' ? C.green : '#f43f5e'} />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="f-mono text-[10px]" style={{ color: C.muted }}>Time solicitado:</span>
                  <Chip label={time?.nome ?? '—'} color={mod?.cor ?? C.muted} />
                  {mod && <span className="text-sm">{mod.emoji}</span>}
                </div>
                {s.status === 'PENDENTE' && (
                  <div className="flex gap-2">
                    <button onClick={() => setConfirm({ id: s.id, dec: 'APROVADA' })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
                      style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44` }}>
                      <IcoCheck size={14} /> Aceitar
                    </button>
                    <button onClick={() => setConfirm({ id: s.id, dec: 'REJEITADA' })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
                      style={{ background: '#f43f5e1a', color: '#f43f5e', border: '1px solid rgba(244,63,94,.33)' }}>
                      <IcoX size={14} /> Rejeitar
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
      </div>

      {confirm && (
        <ConfirmSheet
          title={confirm.dec === 'APROVADA' ? 'Aceitar solicitação' : 'Rejeitar solicitação'}
          msg={confirm.dec === 'APROVADA'
            ? 'O atleta será adicionado ao time e notificado.'
            : 'A solicitação será rejeitada e o atleta será notificado.'}
          confirmLabel={confirm.dec === 'APROVADA' ? 'Aceitar' : 'Rejeitar'}
          confirmColor={confirm.dec === 'APROVADA' ? C.green : '#f43f5e'}
          onOk={() => decide(confirm.id, confirm.dec)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
