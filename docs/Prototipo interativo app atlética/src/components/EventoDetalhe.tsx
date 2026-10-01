import { C } from '../theme'
import { fmtCard, fmtFull, initials, nowLocal } from '../utils'
import {
  resultadoDoEvento, RESULTADO_LABEL, isMembro, participacaoDe, contagemParticipacao, podeResponder,
} from '../domain'
import { Card, Chip, Av, SH, IcoShield, IcoCheck, IcoX, IcoBack } from './atoms'
import { useApp } from '../AppContext'
import type { Evento, EventoStatus, Resultado } from '../types'

export function statusColor(s: EventoStatus) {
  return ({ Agendado: C.blue, 'Em andamento': C.green, Finalizado: C.muted, Cancelado: '#f43f5e' } as Record<EventoStatus, string>)[s]
}

export function resultadoColor(r: Resultado) {
  return r === 'VITORIA' ? C.green : r === 'EMPATE' ? C.yellow : '#f43f5e'
}

// Nomes de exibição de um evento a partir do store
export function useEventoInfo(ev: Evento) {
  const { times, atleticas, modalidades } = useApp()
  const time = times.find(t => t.id === ev.timeId)
  const adv = ev.timeAdversarioId ? times.find(t => t.id === ev.timeAdversarioId) : undefined
  const advAtletica = adv ? atleticas.find(a => a.id === adv.atleticaId) : undefined
  const mod = modalidades.find(m => m.id === time?.modalidadeId)
  const titulo = ev.tipo === 'JOGO'
    ? `${time?.nome ?? '—'} × ${advAtletica?.nome ?? '—'}`
    : `Treino — ${time?.nome ?? '—'}`
  return { time, adv, advAtletica, mod, titulo }
}

// Card de evento usado na Home, Agenda, Perfil e Times
export function EventoCard({ ev, onClick, right }: { ev: Evento; onClick: () => void; right?: React.ReactNode }) {
  const { mod, time, advAtletica } = useEventoInfo(ev)
  const isLive = ev.status === 'Em andamento'
  const isCancelled = ev.status === 'Cancelado'
  const cor = ev.tipo === 'JOGO' ? C.red : C.blue
  return (
    <Card onClick={onClick} pad="p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-xl shrink-0 text-lg"
          style={{ width: 44, height: 44, background: cor + '1a', border: `1px solid ${cor}33`, opacity: isCancelled ? .5 : 1 }}>
          {mod?.emoji ?? '🏅'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-px flex-wrap">
            <Chip label={ev.tipo === 'JOGO' ? 'JOGO' : 'TREINO'} color={cor} />
            <Chip label={mod?.nome ?? ''} color={mod?.cor ?? C.muted} />
            {isCancelled && <Chip label="CANCELADO" color="#f43f5e" />}
            {isLive && <Chip label="EM ANDAMENTO" color={C.green} />}
          </div>
          <p className="f-sora font-semibold text-sm truncate"
            style={{ color: isCancelled ? C.muted : C.text, textDecoration: isCancelled ? 'line-through' : 'none' }}>
            {time?.nome}{ev.tipo === 'JOGO' ? ` × ${advAtletica?.nome ?? '—'}` : ''}
          </p>
          <p className="f-mono text-[10px] mt-px truncate" style={{ color: C.muted }}>
            {fmtCard(ev.inicio)} · {ev.local}
          </p>
        </div>
        {right}
      </div>
    </Card>
  )
}

// Selo da minha resposta no card (quando sou do elenco)
export function MinhaRespostaChip({ ev }: { ev: Evento }) {
  const { me, membros, participacoes } = useApp()
  if (!isMembro(membros, ev.timeId, me.id) || ev.status !== 'Agendado') return null
  const c = participacaoDe(participacoes, ev.id, me.id)?.confirmado
  if (c === true) return <Chip label="VOU" color={C.green} />
  if (c === false) return <Chip label="NÃO VOU" color="#f43f5e" />
  return <Chip label="RESPONDER" color={C.yellow} />
}

export default function EventoDetalhe({ ev, onBack }: { ev: Evento; onBack: () => void }) {
  const { me, membros, participacoes, setParticipacoes, showToast, online, nomeUsuario } = useApp()
  const { time, advAtletica, mod, titulo } = useEventoInfo(ev)

  const isCancelled = ev.status === 'Cancelado'
  const membro = isMembro(membros, ev.timeId, me.id)
  const minha = participacaoDe(participacoes, ev.id, me.id)
  const regra = podeResponder(ev, membro)
  const { vao, naoVao, semResposta } = contagemParticipacao(participacoes, membros, ev)
  const resultado = resultadoDoEvento(ev)

  function responder(confirmado: boolean) {
    if (!regra.ok || !online()) return
    if (minha?.confirmado === confirmado) return
    const agora = nowLocal()
    setParticipacoes(p => {
      const existe = p.some(x => x.eventoId === ev.id && x.usuarioId === me.id)
      return existe
        ? p.map(x => x.eventoId === ev.id && x.usuarioId === me.id ? { ...x, confirmado, respondidoEm: agora } : x)
        : [...p, { eventoId: ev.id, usuarioId: me.id, confirmado, respondidoEm: agora, presente: null }]
    })
    showToast(confirmado ? 'Participação confirmada' : 'Você marcou que não vai', 'success')
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      {/* Header */}
      <div className="relative overflow-hidden" style={{ paddingTop: 20, paddingBottom: 20 }}>
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
              <Chip label={ev.status.toUpperCase()} color={statusColor(ev.status)} />
              {ev.serieId && <Chip label="↺ RECORRENTE" color={C.muted} />}
            </div>
            <h2 className="f-sora font-black text-lg leading-tight"
              style={{ color: isCancelled ? C.muted : C.text, textDecoration: isCancelled ? 'line-through' : 'none' }}>
              {titulo}
            </h2>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        {/* Placar ou VS */}
        {ev.tipo === 'JOGO' && (
          <Card pad="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="rounded-2xl flex items-center justify-center"
                  style={{ width: 56, height: 56, background: C.red + '1a', border: `1.5px solid ${C.bdrR}` }}>
                  <IcoShield size={24} color={C.red} />
                </div>
                <span className="f-sora font-bold text-xs text-center leading-tight" style={{ color: C.text }}>{time?.nome}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {resultado ? (
                  <>
                    <span className="f-sora font-black text-3xl" style={{ color: C.text }}>
                      {ev.placarTime} <span style={{ color: C.dim }}>:</span> {ev.placarAdversario}
                    </span>
                    <Chip label={RESULTADO_LABEL[resultado].toUpperCase()} color={resultadoColor(resultado)} />
                  </>
                ) : (
                  <>
                    <span className="f-sora font-black text-2xl" style={{ color: C.muted }}>VS</span>
                    {ev.status === 'Finalizado' && <span className="f-mono text-[10px]" style={{ color: C.yellow }}>Resultado pendente</span>}
                  </>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="rounded-2xl flex items-center justify-center text-2xl"
                  style={{ width: 56, height: 56, background: C.blue + '15', border: `1px solid ${C.bdr}` }}>
                  {mod?.emoji ?? '⚔️'}
                </div>
                <span className="f-sora font-bold text-xs text-center leading-tight" style={{ color: C.muted }}>{advAtletica?.nome ?? '—'}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Informações (RF14) */}
        <Card pad="p-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Data e hora', value: fmtFull(ev.inicio) },
              { label: 'Local', value: ev.local },
              { label: 'Modalidade', value: `${mod?.emoji ?? ''} ${mod?.nome ?? '—'}` },
              { label: 'Status', value: ev.status },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="f-mono text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.dim }}>{label}</div>
                <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{value}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Participação (UC15) */}
        <div>
          <SH title="Participação" sub={`${vao.length} vão · ${naoVao.length} não vão · ${semResposta} sem resposta`} />
          {membro ? (
            <>
              <div className="flex gap-3">
                {([true, false] as const).map(opcao => {
                  const ativo = minha?.confirmado === opcao
                  const cor = opcao ? C.green : '#f43f5e'
                  return (
                    <button key={String(opcao)} onClick={() => responder(opcao)} disabled={!regra.ok}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95 transition-all"
                      style={{
                        background: ativo ? cor : C.card2,
                        color: ativo ? '#fff' : regra.ok ? C.text : C.dim,
                        border: `1px solid ${ativo ? cor : C.bdr}`,
                        opacity: regra.ok ? 1 : .55,
                        cursor: regra.ok ? 'pointer' : 'not-allowed',
                      }}>
                      {opcao ? <IcoCheck size={15} color={ativo ? '#fff' : C.green} /> : <IcoX size={15} color={ativo ? '#fff' : '#f43f5e'} />}
                      {opcao ? 'Vou' : 'Não vou'}
                    </button>
                  )
                })}
              </div>
              <p className="f-mono text-[10px] mt-2 text-center" style={{ color: C.muted }}>
                {!regra.ok
                  ? regra.motivo
                  : minha?.respondidoEm && minha.confirmado !== null
                    ? `Respondido em ${fmtFull(minha.respondidoEm)} · você pode alterar até o início`
                    : 'Você ainda não respondeu'}
              </p>
            </>
          ) : (
            <div className="px-3 py-3 rounded-2xl text-center" style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
              <p className="f-mono text-xs" style={{ color: C.muted }}>{regra.motivo}</p>
            </div>
          )}
        </div>

        {/* Quem vai */}
        {vao.length > 0 && (
          <div>
            <SH title="Quem vai" sub={`${vao.length} confirmados`} />
            <div className="flex flex-col gap-1.5">
              {vao.map(id => (
                <Card key={id} pad="p-3">
                  <div className="flex items-center gap-3">
                    <Av s={initials(nomeUsuario(id))} size={30} bg={C.green + '44'} />
                    <span className="f-sora font-medium text-sm flex-1" style={{ color: C.text }}>
                      {nomeUsuario(id)}{id === me.id ? ' (você)' : ''}
                    </span>
                    {time?.capitaoId === id && <Chip label="CAPITÃO" color={C.yellow} />}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
