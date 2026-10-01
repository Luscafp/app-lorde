import { useState, useCallback, useEffect, useRef } from 'react'
import { AppContext } from './AppContext'
import type { Role, Screen, Tab, Time } from './types'
import type { ToastItem, ConfirmState } from './types'
import { C, ATLETICA } from './theme'
import { canAccessPanel } from './utils'
import { EVENTOS, TIMES, MODALIDADES, ATLETICAS, SOLICITACOES, NOTICIAS, BANNERS, USUARIOS, AUDIT_LOG } from './data'
import { getMeByRole } from './utils'
import type { AuditEntity, DemoState } from './types'

import LoginScreen      from './screens/LoginScreen'
import HomeScreen       from './screens/HomeScreen'
import AgendaScreen     from './screens/AgendaScreen'
import ModalidadesScreen from './screens/ModalidadesScreen'
import PerfilScreen     from './screens/PerfilScreen'
import PainelScreen     from './screens/PainelScreen'

import { IcoHome, IcoCal, IcoSport, IcoUser, IcoBell, IcoWifi, IcoCheck, IcoAlert, IcoX, IcoRefresh } from './components/atoms'

// ─── Toast container ──────────────────────────────────────────────────────────
function ToastBar({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="absolute bottom-24 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl pointer-events-auto a-up"
          style={{
            background: t.type === 'success' ? '#052e16' : '#450a0a',
            border: `1px solid ${t.type === 'success' ? C.green + '55' : '#f43f5e44'}`,
            boxShadow: `0 8px 24px ${t.type === 'success' ? '#22c55e22' : '#f43f5e22'}`,
          }}>
          <div className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 22, height: 22, background: t.type === 'success' ? C.green + '33' : '#f43f5e33' }}>
            {t.type === 'success'
              ? <IcoCheck size={12} color={C.green} />
              : <IcoX size={12} color="#f43f5e" />}
          </div>
          <span className="f-sora font-semibold text-sm flex-1" style={{ color: t.type === 'success' ? C.green : '#f87171' }}>
            {t.message}
          </span>
          <button className="shrink-0" onClick={() => onRemove(t.id)}>
            <IcoX size={12} color={C.muted} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, onCancel])

  if (!state) return null
  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-6 a-up"
        style={{ background: C.card, border: `1px solid ${C.bdr}`, boxShadow: '0 -16px 40px rgba(0,0,0,.5)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center rounded-2xl"
            style={{ width: 44, height: 44, background: C.red + '1a', border: `1px solid ${C.bdrR}` }}>
            <IcoAlert size={22} color={C.red} />
          </div>
          <h3 className="f-sora font-black text-lg" style={{ color: C.text }}>{state.title}</h3>
        </div>
        <p className="f-mono text-sm mb-6" style={{ color: C.muted }}>{state.message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>
            Cancelar
          </button>
          <button onClick={() => { state.onConfirm(); onCancel() }}
            className="flex-1 py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
            style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Offline banner ───────────────────────────────────────────────────────────
function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 a-up"
      style={{ background: '#431407', borderBottom: `1px solid ${C.orange}33` }}>
      <IcoWifi size={13} color={C.orange} />
      <span className="f-mono text-[11px]" style={{ color: C.orange }}>
        Você está offline — exibindo os últimos dados
      </span>
      <IcoRefresh size={13} color={C.orange} />
    </div>
  )
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; Icon: React.FC<{ size: number; color: string; fill?: boolean }> }[] = [
  { id: 'home',        label: 'Início',  Icon: IcoHome  },
  { id: 'agenda',      label: 'Agenda',  Icon: IcoCal   },
  { id: 'modalidades', label: 'Times',   Icon: IcoSport },
  { id: 'perfil',      label: 'Perfil',  Icon: IcoUser  },
]

const TAB_SCREENS = new Set<Screen>(['home', 'agenda', 'modalidades', 'perfil'])

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [role, setRole]         = useState<Role>('atleta')
  const [screen, setScreen]     = useState<Screen>('home')
  const [toasts, setToasts]     = useState<ToastItem[]>([])
  const [confirm, setConfirm]   = useState<ConfirmState>(null)
  const [offline]               = useState(false)
  const [eventos, setEventos] = useState(EVENTOS)
  const [times, setTimes] = useState<Time[]>(TIMES.map(t => ({ ...t, ativo: t.ativo ?? true })))
  const [modalidades, setModalidades] = useState(MODALIDADES)
  const [atleticas, setAtleticas] = useState(ATLETICAS)
  const [solicitacoes, setSolicitacoes] = useState(SOLICITACOES)
  const [noticias, setNoticias] = useState(NOTICIAS)
  const [banners, setBanners] = useState(BANNERS)
  const [usuarios, setUsuarios] = useState(USUARIOS)
  const [auditoria, setAuditoria] = useState(AUDIT_LOG)
  const demoState: DemoState = offline ? 'offline' : 'ready'
  const toastTimer              = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const activeTab = TAB_SCREENS.has(screen) ? screen as Tab : null

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

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirm({ title, message, onConfirm })
  }, [])

  const audit = useCallback((entidade: AuditEntity, acao: string, alvo: string) => {
    const me = getMeByRole(role)
    setAuditoria(p => [{
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      usuarioId: me.id,
      nomeUsuario: me.nome,
      entidade,
      acao,
      alvo,
      data: new Date().toISOString(),
    }, ...p])
  }, [role])

  if (!loggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: C.bg }}>
        <div className="relative overflow-hidden rounded-[48px] shadow-2xl"
          style={{ width: 390, height: 844, background: C.bg, border: `1px solid ${C.bdr}` }}>
          <LoginScreen onLogin={(r) => { setRole(r); setLoggedIn(true) }} />
        </div>
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      role, setScreen, showToast, showConfirm,
      eventos, setEventos, times, setTimes, modalidades, setModalidades,
      atleticas, setAtleticas, solicitacoes, setSolicitacoes,
      noticias, setNoticias, banners, setBanners, usuarios, setUsuarios,
      auditoria, audit, demoState,
    }}>
      <div className="flex items-center justify-center min-h-screen" style={{ background: C.bg }}>
        <div className="relative overflow-hidden rounded-[48px] shadow-2xl flex flex-col"
          style={{ width: 390, height: 844, background: C.bg, border: `1px solid ${C.bdr}` }}>

          {/* Status bar */}
          <div className="flex items-center justify-between px-7 py-3 shrink-0" style={{ background: C.bg }}>
            <span className="f-mono text-[11px] font-semibold" style={{ color: C.text }}>9:41</span>
            <div className="flex items-center gap-1.5">
              <IcoWifi size={13} color={C.text} />
              <IcoBell size={13} color={C.text} />
              <span className="f-mono text-[11px] font-semibold" style={{ color: C.text }}>100%</span>
            </div>
          </div>

          <OfflineBanner visible={offline} />

          {/* Screen content */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {screen === 'home'        && <HomeScreen />}
            {screen === 'agenda'      && <AgendaScreen />}
            {screen === 'modalidades' && <ModalidadesScreen />}
            {screen === 'perfil'      && <PerfilScreen />}
            {screen === 'painel' && canAccessPanel(role) && <PainelScreen />}
          </div>

          {/* Bottom nav */}
          {screen !== 'painel' && (
            <div className="shrink-0 flex items-center px-4 pb-6 pt-3 gap-1"
              style={{ background: C.s1, borderTop: `1px solid ${C.bdr}` }}>
              {TABS.map(({ id, label, Icon }) => {
                const isActive = activeTab === id
                return (
                  <button key={id} onClick={() => setScreen(id)}
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

          {/* Overlays */}
          <ToastBar toasts={toasts} onRemove={removeToast} />
          <ConfirmModal state={confirm} onCancel={() => setConfirm(null)} />
        </div>
      </div>
    </AppContext.Provider>
  )
}
