import { useState } from 'react'
import { C } from '../../theme'
import { fmtFull, initials, nowLocal } from '../../utils'
import { isMembro } from '../../domain'
import { Card, Chip, Av, IcoCheck, IcoX } from '../../components/atoms'
import { EmptyState } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { StatusSolicitacao } from '../../types'

const STATUS_COR: Record<StatusSolicitacao, string> = {
  PENDENTE: C.yellow, APROVADA: C.green, REJEITADA: '#f43f5e', CANCELADA: C.muted,
}
const STATUS_LABEL: Record<StatusSolicitacao, string> = {
  PENDENTE: 'PENDENTE', APROVADA: 'APROVADA', REJEITADA: 'REJEITADA', CANCELADA: 'CANCELADA PELO ATLETA',
}

// ─── Seção Solicitações (UC20) ────────────────────────────────────────────────
export default function SolicsSection() {
  const {
    solicitacoes, setSolicitacoes, membros, setMembros, times, modalidades,
    showToast, showConfirm, audit, online, nomeUsuario,
  } = useApp()
  const [tab, setTab] = useState<'pendentes' | 'historico'>('pendentes')

  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE').sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
  const historico = solicitacoes.filter(s => s.status !== 'PENDENTE')
    .sort((a, b) => (b.avaliadaEm ?? b.criadaEm).localeCompare(a.avaliadaEm ?? a.criadaEm))
  const displayed = tab === 'pendentes' ? pendentes : historico

  function decidir(id: string, dec: 'APROVADA' | 'REJEITADA') {
    if (!online()) return
    const s = solicitacoes.find(x => x.id === id)
    if (!s) return
    // A1: cancelada pelo atleta antes da avaliação
    if (s.status !== 'PENDENTE') { showToast('O atleta cancelou esta solicitação', 'error'); return }
    const time = times.find(t => t.id === s.timeId)
    setSolicitacoes(p => p.map(x => x.id === id ? { ...x, status: dec, avaliadaEm: nowLocal() } : x))
    // RN28: só passa a pertencer ao time após a aprovação
    if (dec === 'APROVADA' && !isMembro(membros, s.timeId, s.usuarioId)) {
      setMembros(p => [...p, { timeId: s.timeId, usuarioId: s.usuarioId, entradaEm: nowLocal() }])
    }
    audit('Solicitações', dec === 'APROVADA' ? 'Aprovou solicitação' : 'Rejeitou solicitação', `${nomeUsuario(s.usuarioId)} → ${time?.nome}`)
    showToast(dec === 'APROVADA' ? 'Solicitação aceita — atleta adicionado ao elenco' : 'Solicitação rejeitada — atleta notificado', 'success')
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {([
            { id: 'pendentes' as const, label: `Pendentes${pendentes.length > 0 ? ` (${pendentes.length})` : ''}` },
            { id: 'historico' as const, label: 'Histórico' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="py-2.5 f-sora font-semibold text-xs"
              style={{ background: tab === t.id ? C.red : 'transparent', color: tab === t.id ? '#fff' : C.muted }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        {displayed.length === 0
          ? <EmptyState message={tab === 'pendentes' ? 'Nenhuma solicitação pendente 🎉' : 'Nenhuma solicitação no histórico'} />
          : displayed.map(s => {
            const time = times.find(t => t.id === s.timeId)
            const mod  = modalidades.find(m => m.id === time?.modalidadeId)
            const nome = nomeUsuario(s.usuarioId)
            return (
              <Card key={s.id} pad="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Av s={initials(nome)} size={44} bg={STATUS_COR[s.status] + (s.status === 'PENDENTE' ? '' : '88')} />
                    <div className="min-w-0">
                      <div className="f-sora font-bold text-sm truncate" style={{ color: C.text }}>{nome}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>Enviada em {fmtFull(s.criadaEm)}</div>
                      {s.avaliadaEm && s.status !== 'CANCELADA' && (
                        <div className="f-mono text-[10px]" style={{ color: C.dim }}>Avaliada em {fmtFull(s.avaliadaEm)}</div>
                      )}
                    </div>
                  </div>
                  <Chip label={STATUS_LABEL[s.status]} color={STATUS_COR[s.status]} />
                </div>
                <div className="flex items-center gap-2" style={{ marginBottom: s.status === 'PENDENTE' ? 16 : 0 }}>
                  <span className="f-mono text-[10px]" style={{ color: C.muted }}>Time:</span>
                  {mod && <span className="text-sm">{mod.emoji}</span>}
                  <Chip label={time?.nome ?? '—'} color={mod?.cor ?? C.muted} />
                </div>
                {s.status === 'PENDENTE' && (
                  <div className="flex gap-2">
                    <button onClick={() => showConfirm('Aceitar solicitação', `${nome} será adicionado ao elenco do ${time?.nome} e notificado.`, () => decidir(s.id, 'APROVADA'), 'Aceitar')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
                      style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44` }}>
                      <IcoCheck size={14} /> Aceitar
                    </button>
                    <button onClick={() => showConfirm('Rejeitar solicitação', `A solicitação de ${nome} será rejeitada. O atleta poderá enviar outra depois.`, () => decidir(s.id, 'REJEITADA'), 'Rejeitar')}
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
    </div>
  )
}
