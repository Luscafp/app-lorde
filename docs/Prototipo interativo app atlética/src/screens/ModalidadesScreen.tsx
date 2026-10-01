import { useState } from 'react'
import { C, ATLETICA } from '../theme'
import { initials, fmtCard, fmtHora, diaSemana, parseLocal, nowLocal } from '../utils'
import { elencoIds, encerrarVinculo, isMembro, proximosTreinos, solicitacaoPendente } from '../domain'
import { Card, Chip, Av, SH, IcoBack, IcoChev, IcoStar, IcoPlus, IcoCheck, IcoX } from '../components/atoms'
import { EmptyState, ListaGate, useEstadoLista } from '../components/shared'
import { useApp } from '../AppContext'
import type { Modalidade } from '../types'

// ─── Detalhe do time (UC04 passo 5 e UC14) ────────────────────────────────────
function TimeDetail({ timeId, mod, onBack }: { timeId: string; mod: Modalidade; onBack: () => void }) {
  const {
    me, times, setTimes, eventos, membros, setMembros, solicitacoes, setSolicitacoes,
    showToast, showConfirm, online, abrirEvento, nomeUsuario,
  } = useApp()
  const time = times.find(t => t.id === timeId)
  if (!time) return null

  const membro = isMembro(membros, time.id, me.id)
  const pendente = solicitacaoPendente(solicitacoes, me.id, time.id)
  const elenco = elencoIds(membros, time.id)
    .sort((a, b) => (a === time.capitaoId ? -1 : b === time.capitaoId ? 1 : nomeUsuario(a).localeCompare(nomeUsuario(b))))
  const treinos = proximosTreinos(eventos, time.id).slice(0, 4)

  function solicitar() {
    showConfirm('Solicitar entrada',
      `Enviar uma solicitação para entrar no ${time!.nome}? A diretoria vai aceitar ou rejeitar.`,
      () => {
        if (!online()) return
        // RN27: não pode haver duas solicitações pendentes para o mesmo time
        if (solicitacaoPendente(solicitacoes, me.id, time!.id)) { showToast('Você já tem uma solicitação pendente para este time', 'error'); return }
        setSolicitacoes(p => [...p, { id: `sol-${Date.now()}`, usuarioId: me.id, timeId: time!.id, status: 'PENDENTE', criadaEm: nowLocal() }])
        showToast('Solicitação enviada — aguarde a diretoria', 'success')
      }, 'Enviar solicitação')
  }

  function cancelar() {
    showConfirm('Cancelar solicitação', 'Deseja cancelar sua solicitação de entrada neste time?', () => {
      if (!online()) return
      setSolicitacoes(p => p.map(s => s.id === pendente?.id ? { ...s, status: 'CANCELADA' } : s))
      showToast('Solicitação cancelada', 'success')
    }, 'Cancelar solicitação')
  }

  function sair() {
    showConfirm('Sair do time', `Deseja sair do ${time!.nome}? Para voltar, será preciso enviar nova solicitação.`, () => {
      if (!online()) return
      setMembros(p => encerrarVinculo(p, me.id, time!.id))
      // RN23: o capitão precisa pertencer ao elenco
      if (time!.capitaoId === me.id) setTimes(p => p.map(t => t.id === time!.id ? { ...t, capitaoId: undefined } : t))
      showToast('Você saiu do time', 'success')
    }, 'Sair do time')
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
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
        <p className="f-mono text-[10px]" style={{ color: C.muted }}>{mod.nome} · {ATLETICA.nome} · {elenco.length} atletas</p>
      </div>

      {membro && (
        <div className="mx-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: C.green + '18', border: `1px solid ${C.green}33` }}>
          <IcoCheck size={16} color={C.green} />
          <span className="f-sora font-semibold text-sm" style={{ color: C.green }}>Você faz parte deste time</span>
        </div>
      )}
      {!membro && pendente && (
        <div className="mx-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: C.yellow + '18', border: `1px solid ${C.yellow}33` }}>
          <span className="f-mono text-sm">⏳</span>
          <span className="f-sora font-semibold text-sm" style={{ color: C.yellow }}>Solicitação pendente de aprovação</span>
        </div>
      )}

      {/* Elenco com capitão (RF20) */}
      <div className="px-4">
        <SH title="Elenco" sub={`${elenco.length} atletas`} />
        {elenco.length === 0
          ? <p className="f-mono text-xs py-3 text-center" style={{ color: C.muted }}>Elenco ainda vazio</p>
          : (
            <div className="flex flex-col gap-1.5">
              {elenco.map(id => {
                const cap = id === time.capitaoId
                return (
                  <Card key={id} pad="p-3">
                    <div className="flex items-center gap-3">
                      <Av s={initials(nomeUsuario(id))} size={32} bg={cap ? `linear-gradient(135deg,${mod.cor},${mod.cor}88)` : C.card2} />
                      <span className="f-sora font-medium text-sm flex-1" style={{ color: C.text }}>
                        {nomeUsuario(id)}{id === me.id ? ' (você)' : ''}
                      </span>
                      {cap && <><Chip label="CAPITÃO" color={C.yellow} /><IcoStar size={14} /></>}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
      </div>

      {/* Próximos treinos (RF21) */}
      <div className="px-4">
        <SH title="Próximos treinos" />
        {treinos.length === 0
          ? <p className="f-mono text-xs py-3 text-center" style={{ color: C.muted }}>Sem treinos agendados</p>
          : (
            <div className="flex flex-col gap-2">
              {treinos.map(t => {
                const d = parseLocal(t.inicio)
                return (
                  <Card key={t.id} pad="p-3" onClick={() => abrirEvento(t.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center rounded-xl shrink-0"
                        style={{ width: 44, height: 44, background: mod.cor + '18', border: `1px solid ${mod.cor}33` }}>
                        <span className="f-sora font-black text-sm leading-none" style={{ color: mod.cor }}>{d.getDate()}</span>
                        <span className="f-mono text-[9px]" style={{ color: C.muted }}>{diaSemana(t.inicio).toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>
                          {fmtHora(t.inicio)} · Treino{t.serieId ? ' recorrente' : ''}
                        </div>
                        <div className="f-mono text-[10px]" style={{ color: C.muted }}>{t.local}</div>
                      </div>
                      <IcoChev />
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
      </div>

      {/* Ações */}
      <div className="px-4 flex flex-col gap-2">
        {membro ? (
          <button onClick={sair}
            className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#f43f5e1a', color: '#f43f5e', border: '1px solid rgba(244,63,94,.3)' }}>
            <IcoX size={14} color="#f43f5e" /> Sair do time
          </button>
        ) : pendente ? (
          <button onClick={cancelar}
            className="w-full py-4 rounded-2xl f-sora font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: C.yellow + '1a', color: C.yellow, border: `1px solid ${C.yellow}44` }}>
            <IcoX size={16} color={C.yellow} /> Cancelar solicitação
          </button>
        ) : (
          <button onClick={solicitar}
            className="w-full py-4 rounded-2xl f-sora font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg,${mod.cor},${mod.cor}cc)`, color: '#fff', boxShadow: `0 4px 20px ${mod.cor}44` }}>
            <IcoPlus size={18} /> Solicitar entrada
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main export (UC04) ───────────────────────────────────────────────────────
export default function ModalidadesScreen() {
  const { times, modalidades, membros, eventos, demo, setDemo } = useApp()
  const { estado, tentarNovamente } = useEstadoLista(demo, setDemo)
  const [modId, setModId] = useState<string | null>(null)
  const [timeId, setTimeId] = useState<string | null>(null)

  const activeMods = modalidades.filter(m => m.ativa)
  const timesDaAtletica = times.filter(t => t.atleticaId === ATLETICA.id && t.ativo)
  const mod = activeMods.find(m => m.id === modId)

  if (mod && timeId) {
    return <TimeDetail timeId={timeId} mod={mod} onBack={() => setTimeId(null)} />
  }

  // Times da modalidade escolhida
  if (mod) {
    const lista = timesDaAtletica.filter(t => t.modalidadeId === mod.id)
    return (
      <div className="flex flex-col gap-4 pb-4 a-up">
        <div className="px-4 pt-5 flex items-center gap-3">
          <button onClick={() => setModId(null)}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
            <IcoBack />
          </button>
          <div>
            <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>{mod.emoji} {mod.nome}</h2>
            <p className="f-mono text-[10px]" style={{ color: C.muted }}>{lista.length} times</p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 px-4">
          {lista.length === 0
            ? <EmptyState icon={<span className="text-4xl opacity-40">{mod.emoji}</span>} message="Nenhum time cadastrado" />
            : lista.map(t => {
              const prox = proximosTreinos(eventos, t.id)[0]
              const n = elencoIds(membros, t.id).length
              return (
                <Card key={t.id} onClick={() => setTimeId(t.id)} pad="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-2xl shrink-0 text-2xl"
                      style={{ width: 52, height: 52, background: mod.cor + '1a', border: `1px solid ${mod.cor}30` }}>
                      {mod.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="f-sora font-bold text-base" style={{ color: C.text }}>{t.nome}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{n} atletas</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: prox ? mod.cor : C.dim }}>
                        {prox ? `Próximo treino: ${fmtCard(prox.inicio)}` : 'Sem treinos agendados'}
                      </div>
                    </div>
                    <IcoChev />
                  </div>
                </Card>
              )
            })}
        </div>
      </div>
    )
  }

  // Lista de modalidades ativas
  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      <div className="px-4 pt-5">
        <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>Times</h2>
        <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>Escolha uma modalidade</p>
      </div>
      <div className="flex flex-col gap-2.5 px-4">
        <ListaGate estado={estado} onRetry={tentarNovamente}>
          {activeMods.length === 0
            ? <EmptyState message="Nenhuma modalidade disponível" />
            : activeMods.map(m => {
              const n = timesDaAtletica.filter(t => t.modalidadeId === m.id).length
              return (
                <Card key={m.id} onClick={() => setModId(m.id)} pad="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-2xl shrink-0 text-2xl"
                      style={{ width: 52, height: 52, background: m.cor + '1a', border: `1px solid ${m.cor}30` }}>
                      {m.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="f-sora font-bold text-base" style={{ color: C.text }}>{m.nome}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>
                        {n === 0 ? 'Nenhum time cadastrado' : `${n} ${n === 1 ? 'time' : 'times'}`}
                      </div>
                    </div>
                    <IcoChev />
                  </div>
                </Card>
              )
            })}
        </ListaGate>
      </div>
    </div>
  )
}
