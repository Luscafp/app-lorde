import { useState } from 'react'
import { C, ATLETICA } from '../theme'
import { canManageUsers, canDelete, canManageRoles, ROLE_LABEL } from '../utils'
import { Card, SH, Chip, IcoBack, IcoCal, IcoSport, IcoShield, IcoNewspaper, IcoImage, IcoBell, IcoUsers, IcoHome, IcoChev } from '../components/atoms'
import { ErrorState, SkeletonList } from '../components/shared'
import { useApp } from '../AppContext'
import type { Role } from '../types'

import EventosSection from './painel/EventosSection'
import TimesSection   from './painel/TimesSection'
import SolicsSection  from './painel/SolicsSection'
import { NoticiasSection, BannersSection } from './painel/ConteudoSection'
import UsuariosSection from './painel/UsuariosSection'

type Section = 'overview' | 'eventos' | 'times' | 'solics' | 'noticias' | 'banners' | 'avisos' | 'usuarios'

const ROLE_COLORS: Record<Role, string> = {
  atleta: C.muted, diretor: C.blue, vice: C.blue, presidente: C.yellow, admin: C.red,
}

// ─── Avisos Section ───────────────────────────────────────────────────────────
function AvisosSection() {
  const { showToast, showConfirm, times: TIMES, modalidades: MODALIDADES, usuarios, audit } = useApp()
  const [titulo, setTitulo]   = useState('')
  const [mensagem, setMsg]    = useState('')
  const [destino, setDestino] = useState<'todos' | string>('todos')

  const lordeTimes = TIMES.filter(t => t.atleticaId === 'lorde')

  function send() {
    if (!titulo.trim() || !mensagem.trim()) { showToast('Preencha título e mensagem', 'error'); return }
    const target = TIMES.find(t => t.id === destino)
    const count = destino === 'todos'
      ? usuarios.filter(u => u.ativo).length
      : new Set([...(target?.atletas ?? []), ...(target?.capitao ? [target.capitao] : [])]).size
    showConfirm('Confirmar envio', `Enviar aviso para ${count} usuários?`, () => {
      audit('Avisos', 'Enviou aviso', `${titulo} · ${destino === 'todos' ? 'Todos' : target?.nome}`)
      showToast('Aviso enviado — usuários notificados!', 'success')
      setTitulo(''); setMsg(''); setDestino('todos')
    })
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex flex-col gap-4">
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do aviso"
            className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
        </div>
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Mensagem</label>
          <textarea value={mensagem} onChange={e => setMsg(e.target.value)} placeholder="Texto do aviso..." rows={4}
            className="w-full px-4 py-3 rounded-xl f-mono text-xs outline-none resize-none leading-loose"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
        </div>
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Destinatários</label>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setDestino('todos')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
              style={{ background: destino === 'todos' ? C.red + '18' : C.card2, border: `1px solid ${destino === 'todos' ? C.red + '55' : C.bdr}` }}>
              <div className="flex items-center justify-center rounded-full"
                style={{ width: 16, height: 16, border: `2px solid ${destino === 'todos' ? C.red : C.dim}`, background: destino === 'todos' ? C.red : 'transparent' }}>
                {destino === 'todos' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>Todos os usuários</span>
            </button>
            {lordeTimes.map(t => {
              const mod = MODALIDADES.find(m => m.id === t.modalidadeId)
              return (
                <button key={t.id} onClick={() => setDestino(t.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                  style={{ background: destino === t.id ? C.blue + '18' : C.card2, border: `1px solid ${destino === t.id ? C.bdrB : C.bdr}` }}>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 16, height: 16, border: `2px solid ${destino === t.id ? C.blueL : C.dim}`, background: destino === t.id ? C.blueL : 'transparent' }}>
                    {destino === t.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span className="text-sm">{mod?.emoji}</span>
                  <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{t.nome}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        {(titulo || mensagem) && (
          <div>
            <p className="f-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: C.dim }}>Prévia da notificação</p>
            <div className="px-4 py-3 rounded-2xl" style={{ background: C.card2, border: `1px solid ${C.bdr}` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: C.red + '22' }}>
                  <IcoBell size={13} color={C.red} />
                </div>
                <span className="f-sora font-bold text-xs" style={{ color: C.text }}>
                  {titulo || 'Título do aviso'}
                </span>
              </div>
              <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.muted }}>
                {mensagem || 'Mensagem do aviso...'}
              </p>
            </div>
          </div>
        )}

        <button onClick={send}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          Enviar aviso
        </button>
      </div>
    </div>
  )
}

// ─── Overview Section ─────────────────────────────────────────────────────────
function OverviewSection({ onNav }: { onNav: (s: Section, resultFilter?: boolean) => void }) {
  const { eventos: EVENTOS, solicitacoes: SOLICITACOES, noticias: NOTICIAS, times: TIMES, modalidades: MODALIDADES } = useApp()
  const proxEventos   = EVENTOS.filter(e => e.status === 'Agendado' || e.status === 'Em andamento').length
  const pendSolics    = SOLICITACOES.filter(s => s.status === 'PENDENTE').length
  const presencasPend = EVENTOS.filter(e => (e.status === 'Em andamento' || e.status === 'Finalizado') && !(e.participacoes ?? []).some(p => p.presente !== undefined)).length
  const rascunhos     = NOTICIAS.filter(n => n.status === 'Rascunho').length

  const counters = [
    { label: 'Próximos eventos',      value: proxEventos,   color: C.blue,   section: 'eventos'  as Section },
    { label: 'Solicitações pend.',     value: pendSolics,    color: C.yellow, section: 'solics'   as Section },
    { label: 'Presenças a registrar', value: presencasPend, color: C.green,  section: 'eventos'  as Section },
    { label: 'Notícias em rascunho',  value: rascunhos,     color: C.red,    section: 'noticias' as Section },
  ]

  const quickActions = [
    { label: 'Novo evento',      icon: IcoCal,        color: C.red,    section: 'eventos'  as Section },
    { label: 'Registrar resultado', icon: IcoShield,  color: C.yellow, section: 'eventos'  as Section, resultFilter: true },
    { label: 'Ver solicitações', icon: IcoUsers,      color: C.blue,   section: 'solics'   as Section },
    { label: 'Publicar notícia', icon: IcoNewspaper,  color: C.green,  section: 'noticias' as Section },
  ]

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      {/* Counter cards */}
      <div>
        <SH title="Resumo" />
        <div className="grid grid-cols-2 gap-3">
          {counters.map(c => (
            <Card key={c.label} onClick={() => onNav(c.section)} pad="p-4">
              <div className="f-sora font-black text-4xl mb-1" style={{ color: c.color }}>{c.value}</div>
              <div className="f-mono text-[10px] leading-tight" style={{ color: C.muted }}>{c.label}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <SH title="Ações rápidas" />
        <div className="flex flex-col gap-2">
          {quickActions.map(a => (
            <button key={a.label} onClick={() => onNav(a.section, 'resultFilter' in a && a.resultFilter)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left active:scale-[.98]"
              style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
              <div className="flex items-center justify-center rounded-xl"
                style={{ width: 36, height: 36, background: a.color + '18' }}>
                <a.icon size={18} color={a.color} />
              </div>
              <span className="flex-1 f-sora font-semibold text-sm" style={{ color: C.text }}>{a.label}</span>
              <IcoChev />
            </button>
          ))}
        </div>
      </div>

      {/* Active events quick list */}
      {EVENTOS.filter(e => e.status === 'Em andamento').length > 0 && (
        <div>
          <SH title="Ao vivo agora" />
          {EVENTOS.filter(e => e.status === 'Em andamento').map(ev => {
            const tl  = TIMES.find(t => t.id === ev.timeLordeId)
            const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
            return (
              <Card key={ev.id} pad="p-3">
                <div className="flex items-center gap-3">
                  <span className="a-pulse inline-block w-2 h-2 rounded-full" style={{ background: C.green }} />
                  <span className="text-lg">{mod?.emoji}</span>
                  <span className="f-sora font-semibold text-sm flex-1" style={{ color: C.text }}>{tl?.nome}</span>
                  <Chip label="AO VIVO" color={C.green} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main PainelScreen ────────────────────────────────────────────────────────
type NavEntry = { id: Section; label: string; Icon: React.FC<{ size: number; color: string }>; minRole?: Role }

const NAV: NavEntry[] = [
  { id: 'overview',  label: 'Visão Geral', Icon: IcoHome      },
  { id: 'eventos',   label: 'Eventos',     Icon: IcoCal       },
  { id: 'times',     label: 'Times',       Icon: IcoSport     },
  { id: 'solics',    label: 'Solicitações', Icon: IcoShield   },
  { id: 'noticias',  label: 'Notícias',    Icon: IcoNewspaper },
  { id: 'banners',   label: 'Banners',     Icon: IcoImage     },
  { id: 'avisos',    label: 'Avisos',      Icon: IcoBell      },
  { id: 'usuarios',  label: 'Usuários',    Icon: IcoUsers,    minRole: 'presidente' as Role },
]

export default function PainelScreen() {
  const { role, setScreen, solicitacoes, demoState } = useApp()
  const [section, setSection] = useState<Section>('overview')
  const [resultFilter, setResultFilter] = useState(false)

  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE').length

  const visible = NAV.filter(n => {
    if (!n.minRole) return true
    return canManageUsers(role)
  })

  const SECTION_TITLES: Record<Section, string> = {
    overview: 'Painel',
    eventos:  'Eventos',
    times:    'Times & Modalidades',
    solics:   'Solicitações',
    noticias: 'Notícias',
    banners:  'Banners',
    avisos:   'Avisos',
    usuarios: 'Usuários',
  }

  return (
    <div className="flex flex-col gap-0 a-up" style={{ height: '100%' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 shrink-0" style={{ borderBottom: `1px solid ${C.bdr}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('home')}
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
          {section !== 'overview' && (
            <button onClick={() => setSection('overview')}
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
              <IcoHome size={17} color={C.muted} />
            </button>
          )}
        </div>

        {/* Section nav */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
          {visible.map(n => {
            const isActive = section === n.id
            const badge = n.id === 'solics' ? pendentes : 0
            return (
              <button key={n.id} onClick={() => { setResultFilter(false); setSection(n.id) }}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto pt-3">
        {demoState === 'loading' && <div className="px-4"><SkeletonList n={4} /></div>}
        {demoState === 'error' && <ErrorState onRetry={() => {}} />}
        {(demoState === 'ready' || demoState === 'offline') && <>
        {section === 'overview'  && <OverviewSection onNav={(next, filter) => { setResultFilter(!!filter); setSection(next) }} />}
        {section === 'eventos'   && <EventosSection initialResultFilter={resultFilter} />}
        {section === 'times'     && <TimesSection />}
        {section === 'solics'    && <SolicsSection />}
        {section === 'noticias'  && <NoticiasSection showDelete={canDelete(role)} />}
        {section === 'banners'   && <BannersSection />}
        {section === 'avisos'    && <AvisosSection />}
        {section === 'usuarios'  && canManageUsers(role) && <UsuariosSection />}
        </>}
      </div>
    </div>
  )
}
