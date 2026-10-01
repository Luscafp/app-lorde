import { useState, useCallback, useRef } from 'react'
import type { FC } from 'react'
import { AppContext } from './AppContext'
import type { AppCtx } from './AppContext'
import type { Screen, Tab, AgendaTab, ToastItem, ConfirmState, AuditEntity, DemoFlags, Usuario } from './types'
import { C } from './theme'
import { canAccessPanel, nowLocal } from './utils'
import {
  EVENTOS, PARTICIPACOES, TIMES, MEMBROS, MODALIDADES, ATLETICAS, SOLICITACOES, NOTICIAS, BANNERS, USUARIOS, AUDIT_LOG, DEMO_SENHA,
} from './data'

import LoginScreen       from './screens/LoginScreen'
import HomeScreen        from './screens/HomeScreen'
import AgendaScreen      from './screens/AgendaScreen'
import ModalidadesScreen from './screens/ModalidadesScreen'
import PerfilScreen, { PREFS_PADRAO } from './screens/PerfilScreen'
import type { Prefs } from './screens/PerfilScreen'
import PainelScreen      from './screens/PainelScreen'
import EventoDetalhe     from './components/EventoDetalhe'
import { ToastBar, ConfirmModal, OfflineBanner, DemoMenu } from './components/shared'

import { IcoHome, IcoCal, IcoSport, IcoUser, IcoBell, IcoWifi } from './components/atoms'

// ─── Bottom nav ───────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; Icon: FC<{ size: number; color: string; fill?: boolean }> }[] = [
  { id: 'home',        label: 'Início',  Icon: IcoHome  },
  { id: 'agenda',      label: 'Agenda',  Icon: IcoCal   },
  { id: 'modalidades', label: 'Times',   Icon: IcoSport },
  { id: 'perfil',      label: 'Perfil',  Icon: IcoUser  },
]

export default function App() {
  const [meId, setMeId]         = useState<string | null>(null)
  const [screen, setScreenRaw]  = useState<Screen>('home')
  const [agendaTab, setAgendaTab] = useState<AgendaTab>('eventos')
  const [eventoAberto, setEventoAberto] = useState<string | null>(null)
  // Tocar numa aba reinicia a tela na raiz (ex.: Times volta à lista de modalidades)
  const [navKey, setNavKey]     = useState(0)
  const [toasts, setToasts]     = useState<ToastItem[]>([])
  const [confirm, setConfirm]   = useState<ConfirmState>(null)
  const [demo, setDemo]         = useState<DemoFlags>({ offline: false, carregando: false, erro: false, notifNegada: false })
  const [demoMenu, setDemoMenu] = useState(false)
  // Preferências de notificação (PreferenciaNotificacao) — uma por usuário
  const [prefs, setPrefsMap] = useState<Record<string, Prefs>>({})

  const [eventos, setEventos]             = useState(EVENTOS)
  const [participacoes, setParticipacoes] = useState(PARTICIPACOES)
  const [times, setTimes]                 = useState(TIMES)
  const [membros, setMembros]             = useState(MEMBROS)
  const [modalidades, setModalidades]     = useState(MODALIDADES)
  const [atleticas, setAtleticas]         = useState(ATLETICAS)
  const [solicitacoes, setSolicitacoes]   = useState(SOLICITACOES)
  const [noticias, setNoticias]           = useState(NOTICIAS)
  const [banners, setBanners]             = useState(BANNERS)
  const [usuarios, setUsuarios]           = useState(USUARIOS)
  const [auditoria, setAuditoria]         = useState(AUDIT_LOG)
  // Senhas simuladas por conta (todas começam com a senha de demonstração)
  const [senhas, setSenhas] = useState<Record<string, string>>(() => Object.fromEntries(USUARIOS.map(u => [u.id, DEMO_SENHA])))
  // Usuários que já viram a tela "Ativar notificações" (exibida no primeiro acesso — UC07 passo 4)
  const [notifVistos, setNotifVistos] = useState<Set<string>>(new Set())

  const toastTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const me = usuarios.find(u => u.id === meId) ?? null

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(p => [...p.slice(-2), { id, message, type }])
    toastTimer.current[id] = setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id))
      delete toastTimer.current[id]
    }, 3200)
  }, [])

  const removeToast = useCallback((id: string) => {
    clearTimeout(toastTimer.current[id])
    delete toastTimer.current[id]
    setToasts(p => p.filter(t => t.id !== id))
  }, [])

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmLabel?: string) => {
    setConfirm({ title, message, onConfirm, confirmLabel })
  }, [])
  const closeConfirm = useCallback(() => setConfirm(null), [])

  const online = useCallback(() => {
    if (demo.offline) { showToast('Sem conexão', 'error'); return false }
    return true
  }, [demo.offline, showToast])

  function setScreen(s: Screen) {
    setEventoAberto(null)
    setScreenRaw(s)
    setNavKey(k => k + 1)
  }

  function logout(toast?: string) {
    setMeId(null)
    setScreenRaw('home')
    setEventoAberto(null)
    setAgendaTab('eventos')
    if (toast) showToast(toast, 'success')
  }

  function entrar(id: string) {
    setMeId(id)
    setScreenRaw('home')
    setNotifVistos(p => new Set(p).add(id))
  }

  function cadastrar(nome: string, email: string, senha: string): Usuario {
    // RN02: toda conta nova recebe o papel Atleta
    const novo: Usuario = { id: `u${Date.now()}`, nome: nome.trim(), email: email.trim().toLowerCase(), role: 'atleta', ativo: true }
    setUsuarios(p => [...p, novo])
    setSenhas(p => ({ ...p, [novo.id]: senha }))
    return novo
  }

  const frame = (children: React.ReactNode) => (
    <div className="flex items-center justify-center min-h-screen" style={{ background: C.bg }}>
      <div className="relative overflow-hidden rounded-[48px] shadow-2xl flex flex-col"
        style={{ width: 390, height: 844, background: C.bg, border: `1px solid ${C.bdr}` }}>
        {children}
        <ToastBar toasts={toasts} onRemove={removeToast} />
        <ConfirmModal state={confirm} onCancel={closeConfirm} />
        {demoMenu && <DemoMenu demo={demo} setDemo={setDemo} onClose={() => setDemoMenu(false)} />}
        <div id="overlay-root" />
      </div>
    </div>
  )

  if (!me) {
    return frame(
      <>
        <OfflineBanner visible={demo.offline} />
        <div className="flex-1 min-h-0">
          <LoginScreen
            usuarios={usuarios}
            senhaCorreta={(id, s) => senhas[id] === s}
            alterarSenha={(id, s) => setSenhas(p => ({ ...p, [id]: s }))}
            primeiroAcesso={id => !notifVistos.has(id)}
            onCadastro={cadastrar}
            onLogin={entrar}
            onDemo={() => setDemoMenu(true)}
            demo={demo}
            showToast={showToast}
          />
        </div>
      </>
    )
  }

  const ctx: AppCtx = {
    me, role: me.role,
    setScreen,
    agendaTab, setAgendaTab,
    openAgenda: tab => { setAgendaTab(tab); setScreen('agenda') },
    abrirEvento: setEventoAberto,
    showToast, showConfirm, logout,
    senhaCorreta: (id, s) => senhas[id] === s,
    alterarSenha: (id, s) => setSenhas(p => ({ ...p, [id]: s })),
    demo, setDemo, online,
    nomeUsuario: id => usuarios.find(u => u.id === id)?.nome ?? 'Usuário',
    eventos, setEventos, participacoes, setParticipacoes, times, setTimes, membros, setMembros,
    modalidades, setModalidades, atleticas, setAtleticas, solicitacoes, setSolicitacoes,
    noticias, setNoticias, banners, setBanners, usuarios, setUsuarios, auditoria,
    audit: (entidade: AuditEntity, acao: string, alvo: string) => setAuditoria(p => [{
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      usuarioId: me.id, nomeUsuario: me.nome, entidade, acao, alvo, data: nowLocal(),
    }, ...p]),
  }

  const evento = eventoAberto ? eventos.find(e => e.id === eventoAberto) : undefined
  const activeTab = screen !== 'painel' ? screen : null

  return (
    <AppContext.Provider value={ctx}>
      {frame(
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between px-7 py-3 shrink-0" style={{ background: C.bg }}>
            <span className="f-mono text-[11px] font-semibold" style={{ color: C.text }}>9:41</span>
            <div className="flex items-center gap-1.5">
              <IcoWifi size={13} color={demo.offline ? C.dim : C.text} />
              <IcoBell size={13} color={C.text} />
              <span className="f-mono text-[11px] font-semibold" style={{ color: C.text }}>100%</span>
            </div>
          </div>

          <OfflineBanner visible={demo.offline} />

          {/* Screen content */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {screen !== 'painel' && evento
              ? <EventoDetalhe ev={evento} onBack={() => setEventoAberto(null)} />
              : <>
                  {screen === 'home'        && <HomeScreen key={navKey} />}
                  {screen === 'agenda'      && <AgendaScreen key={navKey} />}
                  {screen === 'modalidades' && <ModalidadesScreen key={navKey} />}
                  {screen === 'perfil'      && <PerfilScreen key={navKey} onDemo={() => setDemoMenu(true)}
                    prefs={prefs[me.id] ?? PREFS_PADRAO}
                    setPrefs={f => setPrefsMap(p => ({ ...p, [me.id]: f(p[me.id] ?? PREFS_PADRAO) }))} />}
                  {screen === 'painel' && canAccessPanel(me.role) && <PainelScreen key={navKey} />}
                </>}
          </div>

          {/* Bottom nav */}
          {screen !== 'painel' && (
            <div className="shrink-0 flex items-center px-4 pb-6 pt-3 gap-1"
              style={{ background: C.s1, borderTop: `1px solid ${C.bdr}` }}>
              {TABS.map(({ id, label, Icon }) => {
                const isActive = activeTab === id
                return (
                  <button key={id} onClick={() => { if (id === 'agenda') setAgendaTab('eventos'); setScreen(id) }}
                    className="flex-1 flex flex-col items-center gap-1 py-1 rounded-2xl transition-all active:scale-90"
                    style={{ background: isActive ? C.red + '15' : 'transparent' }}>
                    <Icon size={22} color={isActive ? C.red : C.muted} fill={isActive} />
                    <span className="f-mono text-[9px] font-semibold tracking-wide"
                      style={{ color: isActive ? C.red : C.muted }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </AppContext.Provider>
  )
}
