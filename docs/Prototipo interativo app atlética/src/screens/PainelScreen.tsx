import { useState } from 'react'
import type { FC } from 'react'
import { C, ATLETICA } from '../theme'
import { canManageUsers, ROLE_LABEL } from '../utils'
import { elencoIds, presencaRegistrada, resultadoDoEvento } from '../domain'
import { Card, SH, Chip, IcoBack, IcoCal, IcoSport, IcoShield, IcoNewspaper, IcoImage, IcoBell, IcoUsers, IcoHome, IcoChev } from '../components/atoms'
import { Field, ListaGate, useEstadoLista } from '../components/shared'
import { useApp } from '../AppContext'
import type { Role } from '../types'

import EventosSection from './painel/EventosSection'
import TimesSection   from './painel/TimesSection'
import SolicsSection  from './painel/SolicsSection'
import { NoticiasSection, BannersSection } from './painel/ConteudoSection'
import UsuariosSection from './painel/UsuariosSection'

type Section = 'overview' | 'eventos' | 'times' | 'solics' | 'noticias' | 'banners' | 'avisos' | 'usuarios'

const ROLE_COLORS: Record<Role, string> = {
  atleta: C.muted, diretor: C.blue, vice: C.yellow, presidente: C.yellow, admin: C.red,
}

// ─── Enviar aviso (UC25) ──────────────────────────────────────────────────────
function AvisosSection() {
  const { showToast, showConfirm, times, modalidades, membros, usuarios, audit, online } = useApp()
  const [titulo, setTitulo]   = useState('')
  const [mensagem, setMsg]    = useState('')
  const [destino, setDestino] = useState<'todos' | string>('todos')
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const nossosTimes = times.filter(t => t.atleticaId === ATLETICA.id && t.ativo)

  function enviar() {
    const e: Record<string, string> = {}
    if (!titulo.trim()) e.titulo = 'Informe o título'
    if (!mensagem.trim()) e.mensagem = 'Escreva a mensagem'
    setErrors(e)
    if (Object.keys(e).length) return
    const alvo = times.find(t => t.id === destino)
    const n = destino === 'todos'
      ? usuarios.filter(u => u.ativo && !u.excluido).length
      : elencoIds(membros, destino).length
    showConfirm('Confirmar envio', `Enviar aviso para ${n} usuários? Quem desativou "Avisos da diretoria" não recebe.`, () => {
      if (!online()) return
      audit('Avisos', 'Enviou aviso', `${titulo.trim()} · ${destino === 'todos' ? 'Todos os usuários' : alvo?.nome}`)
      showToast('Aviso enviado', 'success')
      setTitulo(''); setMsg(''); setDestino('todos')
    }, 'Enviar')
  }

  const radio = (ativo: boolean, cor: string) => (
    <div className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: 16, height: 16, border: `2px solid ${ativo ? cor : C.dim}`, background: ativo ? cor : 'transparent' }}>
      {ativo && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <Field label="Título" value={titulo} onChange={setTitulo} placeholder="Título do aviso" error={errors.titulo} />
      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Mensagem</label>
        <textarea value={mensagem} onChange={e => setMsg(e.target.value)} placeholder="Texto do aviso..." rows={4}
          className="w-full px-4 py-3 rounded-xl f-mono text-xs outline-none resize-none leading-loose"
          style={{ background: C.card2, border: `1px solid ${errors.mensagem ? '#f43f5e66' : C.bdr}`, color: C.text, caretColor: C.red }} />
        {errors.mensagem && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{errors.mensagem}</p>}
      </div>
      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Destinatários</label>
        <div className="flex flex-col gap-1.5">
          <button onClick={() => setDestino('todos')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
            style={{ background: destino === 'todos' ? C.red + '18' : C.card2, border: `1px solid ${destino === 'todos' ? C.red + '55' : C.bdr}` }}>
            {radio(destino === 'todos', C.red)}
            <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>Todos os usuários</span>
          </button>
          {nossosTimes.map(t => {
            const mod = modalidades.find(m => m.id === t.modalidadeId)
            return (
              <button key={t.id} onClick={() => setDestino(t.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                style={{ background: destino === t.id ? C.blue + '18' : C.card2, border: `1px solid ${destino === t.id ? C.bdrB : C.bdr}` }}>
                {radio(destino === t.id, C.blueL)}
                <span className="text-sm">{mod?.emoji}</span>
                <span className="f-sora font-semibold text-sm flex-1" style={{ color: C.text }}>Membros do {t.nome}</span>
                <span className="f-mono text-[10px]" style={{ color: C.muted }}>{elencoIds(membros, t.id).length}</span>
              </button>
            )
          })}
        </div>
      </div>

      {(titulo || mensagem) && (
        <div>
          <p className="f-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: C.dim }}>Prévia da notificação</p>
          <div className="px-4 py-3 rounded-2xl" style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: C.red + '22' }}>
                <IcoBell size={13} color={C.red} />
              </div>
              <span className="f-sora font-bold text-xs" style={{ color: C.text }}>{titulo || 'Título do aviso'}</span>
            </div>
            <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.muted }}>{mensagem || 'Mensagem do aviso...'}</p>
          </div>
        </div>
      )}

      <button onClick={enviar}
        className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
        style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
        Enviar aviso
      </button>
    </div>
  )
}

// ─── Visão geral ──────────────────────────────────────────────────────────────
function OverviewSection({ onNav }: { onNav: (s: Section, semResultado?: boolean) => void }) {
  const { eventos, participacoes, solicitacoes, noticias, times, modalidades } = useApp()
  const proxEventos   = eventos.filter(e => e.status === 'Agendado' || e.status === 'Em andamento').length
  const pendSolics    = solicitacoes.filter(s => s.status === 'PENDENTE').length
  // Eventos em andamento ou finalizados sem nenhuma presença registrada
  const presencasPend = eventos.filter(e => (e.status === 'Em andamento' || e.status === 'Finalizado') && !presencaRegistrada(participacoes, e.id)).length
  const semResultado  = eventos.filter(e => e.tipo === 'JOGO' && e.status === 'Finalizado' && resultadoDoEvento(e) === null).length
  const rascunhos     = noticias.filter(n => n.status === 'Rascunho').length
  const aoVivo        = eventos.filter(e => e.status === 'Em andamento')

  const counters = [
    { label: 'Próximos eventos',      value: proxEventos,   color: C.blue,   go: () => onNav('eventos') },
    { label: 'Solicitações pendentes', value: pendSolics,   color: C.yellow, go: () => onNav('solics') },
    { label: 'Presenças a registrar', value: presencasPend, color: C.green,  go: () => onNav('eventos') },
    { label: 'Jogos sem resultado',   value: semResultado,  color: C.red,    go: () => onNav('eventos', true) },
  ]

  const quickActions: { label: string; Icon: FC<{ size: number; color: string }>; color: string; go: () => void; sub?: string }[] = [
    { label: 'Novo evento',         Icon: IcoCal,       color: C.red,    go: () => onNav('eventos') },
    { label: 'Registrar resultado', Icon: IcoShield,    color: C.yellow, go: () => onNav('eventos', true), sub: `${semResultado} pendente${semResultado !== 1 ? 's' : ''}` },
    { label: 'Ver solicitações',    Icon: IcoUsers,     color: C.blue,   go: () => onNav('solics') },
    { label: 'Publicar notícia',    Icon: IcoNewspaper, color: C.green,  go: () => onNav('noticias'), sub: `${rascunhos} rascunho${rascunhos !== 1 ? 's' : ''}` },
  ]

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <div>
        <SH title="Resumo" />
        <div className="grid grid-cols-2 gap-3">
          {counters.map(c => (
            <Card key={c.label} onClick={c.go} pad="p-4">
              <div className="f-sora font-black text-4xl mb-1" style={{ color: c.color }}>{c.value}</div>
              <div className="f-mono text-[10px] leading-tight" style={{ color: C.muted }}>{c.label}</div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SH title="Ações rápidas" />
        <div className="flex flex-col gap-2">
          {quickActions.map(a => (
            <button key={a.label} onClick={a.go}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left active:scale-[.98]"
              style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
              <div className="flex items-center justify-center rounded-xl"
                style={{ width: 36, height: 36, background: a.color + '18' }}>
                <a.Icon size={18} color={a.color} />
              </div>
              <span className="flex-1 f-sora font-semibold text-sm" style={{ color: C.text }}>{a.label}</span>
              {a.sub && <span className="f-mono text-[10px]" style={{ color: C.muted }}>{a.sub}</span>}
              <IcoChev />
            </button>
          ))}
        </div>
      </div>

      {aoVivo.length > 0 && (
        <div>
          <SH title="Em andamento agora" />
          <div className="flex flex-col gap-2">
            {aoVivo.map(ev => {
              const tl  = times.find(t => t.id === ev.timeId)
              const mod = modalidades.find(m => m.id === tl?.modalidadeId)
              return (
                <Card key={ev.id} pad="p-3" onClick={() => onNav('eventos')}>
                  <div className="flex items-center gap-3">
                    <span className="a-pulse inline-block w-2 h-2 rounded-full" style={{ background: C.green }} />
                    <span className="text-lg">{mod?.emoji}</span>
                    <span className="f-sora font-semibold text-sm flex-1" style={{ color: C.text }}>
                      {ev.tipo === 'JOGO' ? 'Jogo' : 'Treino'} — {tl?.nome}
                    </span>
                    <Chip label="EM ANDAMENTO" color={C.green} />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Painel ───────────────────────────────────────────────────────────────────
type NavEntry = { id: Section; label: string; Icon: FC<{ size: number; color: string }>; presidencia?: boolean }

const NAV: NavEntry[] = [
  { id: 'overview',  label: 'Visão geral',  Icon: IcoHome      },
  { id: 'eventos',   label: 'Eventos',      Icon: IcoCal       },
  { id: 'times',     label: 'Times',        Icon: IcoSport     },
  { id: 'solics',    label: 'Solicitações', Icon: IcoShield    },
  { id: 'noticias',  label: 'Notícias',     Icon: IcoNewspaper },
  { id: 'banners',   label: 'Banners',      Icon: IcoImage     },
  { id: 'avisos',    label: 'Avisos',       Icon: IcoBell      },
  // Presidência e Administrador (UC23/UC24 e RF43)
  { id: 'usuarios',  label: 'Usuários',     Icon: IcoUsers,    presidencia: true },
]

const SECTION_TITLES: Record<Section, string> = {
  overview: 'Painel da Diretoria',
  eventos:  'Eventos',
  times:    'Times e modalidades',
  solics:   'Solicitações',
  noticias: 'Notícias',
  banners:  'Banners',
  avisos:   'Enviar aviso',
  usuarios: 'Usuários e auditoria',
}

export default function PainelScreen() {
  const { role, setScreen, solicitacoes, demo, setDemo } = useApp()
  const { estado, tentarNovamente } = useEstadoLista(demo, setDemo)
  const [section, setSection] = useState<Section>('overview')
  const [semResultado, setSemResultado] = useState(false)
  // Tocar numa seção (mesmo a atual) volta à lista dela
  const [secKey, setSecKey] = useState(0)

  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE').length
  const visible = NAV.filter(n => !n.presidencia || canManageUsers(role))

  function ir(s: Section, filtro = false) { setSemResultado(filtro); setSection(s); setSecKey(k => k + 1) }

  return (
    <div className="flex flex-col a-in" style={{ minHeight: '100%' }}>
      <div className="px-4 pt-5 pb-3 shrink-0" style={{ borderBottom: `1px solid ${C.bdr}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('home')} title="Voltar ao app"
            className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
            <IcoBack />
          </button>
          <div className="flex-1">
            <h2 className="f-sora font-black text-lg" style={{ color: C.text }}>{SECTION_TITLES[section]}</h2>
            <p className="f-mono text-[9px]" style={{ color: C.muted }}>
              {ATLETICA.sigla} · <span style={{ color: ROLE_COLORS[role] }}>{ROLE_LABEL[role]}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
          {visible.map(n => {
            const isActive = section === n.id
            const badge = n.id === 'solics' ? pendentes : 0
            return (
              <button key={n.id} onClick={() => ir(n.id)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold f-sora"
                style={{ background: isActive ? C.red : C.card, color: isActive ? '#fff' : C.muted, border: `1px solid ${isActive ? C.red : C.bdr}` }}>
                <n.Icon size={11} color={isActive ? '#fff' : C.muted} />
                {n.label}
                {badge > 0 && (
                  <span className="rounded-full f-mono font-bold text-[9px] px-1"
                    style={{ background: isActive ? 'rgba(255,255,255,.25)' : C.red + '22', color: isActive ? '#fff' : C.red }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className={estado === 'pronto' ? 'pt-3' : 'pt-3 px-4'}>
        <ListaGate key={secKey} estado={estado} onRetry={tentarNovamente} n={4}>
          {section === 'overview'  && <OverviewSection onNav={ir} />}
          {section === 'eventos'   && <EventosSection initialResultFilter={semResultado} />}
          {section === 'times'     && <TimesSection onVerSolicitacoes={() => ir('solics')} />}
          {section === 'solics'    && <SolicsSection />}
          {section === 'noticias'  && <NoticiasSection />}
          {section === 'banners'   && <BannersSection />}
          {section === 'avisos'    && <AvisosSection />}
          {section === 'usuarios'  && canManageUsers(role) && <UsuariosSection />}
        </ListaGate>
      </div>
    </div>
  )
}
