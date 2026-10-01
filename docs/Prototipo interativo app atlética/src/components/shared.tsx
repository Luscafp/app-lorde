import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { C } from '../theme'
import type { ToastItem, ConfirmState, DemoFlags } from '../types'
import { IcoAlert, IcoRefresh, IcoWifi, IcoX, IcoCheck, Toggle } from './atoms'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ w = '100%', h = 16, rounded = 8 }:
  { w?: string | number; h?: number; rounded?: number }) {
  return (
    <div className="shimmer-bg"
      style={{ width: w, height: h, borderRadius: rounded, background: C.card2 }} />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
      <div className="flex items-center gap-3">
        <Skeleton w={44} h={44} rounded={14} />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton h={13} rounded={6} />
          <Skeleton w="60%" h={10} rounded={6} />
        </div>
      </div>
      <Skeleton h={10} rounded={6} />
    </div>
  )
}

export function SkeletonList({ n = 3 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: n }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, message, action, onAction }:
  { icon?: ReactNode; message: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
      {icon ?? <span className="text-4xl opacity-40">🗂️</span>}
      <p className="f-sora font-semibold text-sm text-center" style={{ color: C.muted }}>
        {message}
      </p>
      {action && onAction && (
        <button onClick={onAction}
          className="px-5 py-2.5 rounded-xl f-sora font-semibold text-sm active:scale-95"
          style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
          {action}
        </button>
      )}
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }:
  { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
      <div className="flex items-center justify-center rounded-full"
        style={{ width: 56, height: 56, background: '#f43f5e1a', border: '1px solid rgba(244,63,94,.3)' }}>
        <IcoAlert size={24} color="#f43f5e" />
      </div>
      <p className="f-sora font-semibold text-sm text-center" style={{ color: C.muted }}>
        {message ?? 'Não foi possível carregar os dados.'}
      </p>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl f-sora font-semibold text-sm active:scale-95"
        style={{ background: C.red + '1a', color: C.red, border: `1px solid ${C.bdrR}` }}>
        <IcoRefresh size={14} color={C.red} />
        Tentar novamente
      </button>
    </div>
  )
}

// ─── Estados de lista simulados pelo menu Demo (UC01 A3) ──────────────────────
// Com "Simular carregamento", a lista mostra o esqueleto por 800 ms ao abrir;
// com "Simular erro de conexão", mostra o erro com "Tentar novamente".
export function useEstadoLista(demo: DemoFlags, setDemo: (f: (d: DemoFlags) => DemoFlags) => void) {
  const [carregando, setCarregando] = useState(demo.carregando)
  useEffect(() => {
    if (!demo.carregando) { setCarregando(false); return }
    setCarregando(true)
    const t = setTimeout(() => setCarregando(false), 800)
    return () => clearTimeout(t)
  }, [demo.carregando])
  const estado: 'carregando' | 'erro' | 'pronto' = carregando ? 'carregando' : demo.erro ? 'erro' : 'pronto'
  const tentarNovamente = () => setDemo(d => ({ ...d, erro: false }))
  return { estado, tentarNovamente }
}

export function ListaGate({ estado, onRetry, n = 3, children }:
  { estado: 'carregando' | 'erro' | 'pronto'; onRetry: () => void; n?: number; children: ReactNode }) {
  if (estado === 'carregando') return <SkeletonList n={n} />
  if (estado === 'erro') return <ErrorState onRetry={onRetry} />
  return <>{children}</>
}

// ─── Offline banner (RNF19) ───────────────────────────────────────────────────
export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 a-up shrink-0"
      style={{ background: '#431407', borderBottom: `1px solid ${C.orange}33` }}>
      <IcoWifi size={13} color={C.orange} />
      <span className="f-mono text-[11px]" style={{ color: C.orange }}>
        Você está offline — exibindo os últimos dados
      </span>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
// Verde para ações concluídas; vermelho apenas para erros e bloqueios.
export function ToastBar({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="absolute bottom-24 left-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
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

// ─── Overlays: renderizados no #overlay-root da moldura do celular ──────────
// (as telas usam animação com transform, que prenderia um "absolute" dentro da área rolável)
export function Overlay({ children }: { children: ReactNode }) {
  const host = typeof document !== 'undefined' ? document.getElementById('overlay-root') : null
  return host ? createPortal(children, host) : <>{children}</>
}

// ─── Bottom sheet (sempre dentro da moldura do celular) ──────────────────────
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <Overlay><div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full rounded-t-3xl p-5 a-up" onClick={e => e.stopPropagation()}
        style={{ background: C.card, border: `1px solid ${C.bdr}`, boxShadow: '0 -16px 40px rgba(0,0,0,.5)', maxHeight: '88%', overflowY: 'auto' }}>
        {children}
      </div>
    </div></Overlay>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
export function ConfirmModal({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, onCancel])

  if (!state) return null
  return (
    <Sheet onClose={onCancel}>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center rounded-2xl shrink-0"
          style={{ width: 44, height: 44, background: C.red + '1a', border: `1px solid ${C.bdrR}` }}>
          <IcoAlert size={22} color={C.red} />
        </div>
        <h3 className="f-sora font-black text-lg" style={{ color: C.text }}>{state.title}</h3>
      </div>
      <p className="f-mono text-sm mb-6 leading-relaxed" style={{ color: C.muted }}>{state.message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
          style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>
          Cancelar
        </button>
        <button onClick={() => { state.onConfirm(); onCancel() }}
          className="flex-1 py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          {state.confirmLabel ?? 'Confirmar'}
        </button>
      </div>
    </Sheet>
  )
}

// ─── Campos de formulário ─────────────────────────────────────────────────────
export function IcoEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export function Field({ label, value, onChange, type = 'text', placeholder, required, error, disabled, hint }:
  { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
    required?: boolean; error?: string; disabled?: boolean; hint?: string }) {
  return (
    <div>
      <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full px-4 py-3 rounded-2xl f-sora text-sm outline-none transition-all"
        style={{ background: C.card2, border: `1px solid ${error ? '#f43f5e66' : C.bdr}`, color: C.text, caretColor: C.red, opacity: disabled ? .5 : 1 }} />
      {hint && !error && <p className="f-mono text-[10px] mt-1.5" style={{ color: C.dim }}>{hint}</p>}
      {error && <p className="f-mono text-[10px] mt-1.5" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}

export function PasswordField({ label, value, onChange, placeholder = '••••••••', error, disabled, hint }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; disabled?: boolean; hint?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className="w-full px-4 py-3 pr-11 rounded-2xl f-sora text-sm outline-none"
          style={{ background: C.card2, border: `1px solid ${error ? '#f43f5e66' : C.bdr}`, color: C.text, caretColor: C.red, opacity: disabled ? .5 : 1 }} />
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: C.muted }}>
          <IcoEye open={show} />
        </button>
      </div>
      {hint && !error && <p className="f-mono text-[10px] mt-1.5" style={{ color: C.dim }}>{hint}</p>}
      {error && <p className="f-mono text-[10px] mt-1.5" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
      style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
      <IcoX size={14} color="#f87171" />
      <p className="f-mono text-xs" style={{ color: '#f87171' }}>{message}</p>
    </div>
  )
}

// Barra de força: apenas informativa; a validação é a regra de SENHA_REGRA
function pwScore(p: string): 1 | 2 | 3 {
  let s = 0
  if (p.length >= 8) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(3, Math.max(1, s)) as 1 | 2 | 3
}

const PW_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Fraca', color: '#f43f5e' },
  2: { label: 'Média', color: C.yellow },
  3: { label: 'Forte', color: C.green },
}

export function StrBar({ pw }: { pw: string }) {
  if (!pw) return null
  const s = pwScore(pw)
  const cfg = PW_LABELS[s]
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i <= s ? cfg.color : C.dim }} />
        ))}
      </div>
      <span className="f-mono text-[9px]" style={{ color: cfg.color }}>Força: {cfg.label}</span>
    </div>
  )
}

// ─── Termos de Uso e Política de Privacidade (provisórios — seção 8.5) ────────
export function TermsModal({ type, onClose }: { type: 'termos' | 'privacidade'; onClose: () => void }) {
  const termos = (
    <>
      <strong style={{ color: C.text }}>1. Uso do aplicativo</strong>{'\n'}
      O aplicativo organiza a agenda, os times e as notícias da atlética. Qualquer pessoa pode criar uma conta.{'\n\n'}
      <strong style={{ color: C.text }}>2. Cadastro</strong>{'\n'}
      Você declara que as informações fornecidas são verdadeiras e é responsável por manter sua senha em sigilo.{'\n\n'}
      <strong style={{ color: C.text }}>3. Responsabilidades</strong>{'\n'}
      O uso indevido pode resultar na desativação da conta pela diretoria.{'\n\n'}
      <strong style={{ color: C.text }}>4. Alterações</strong>{'\n'}
      A atlética pode modificar estes termos, avisando os usuários pelo aplicativo.
    </>
  )
  const priv = (
    <>
      <strong style={{ color: C.text }}>1. Dados coletados</strong>{'\n'}
      Nome, e-mail, foto (opcional) e sua participação em times e eventos.{'\n\n'}
      <strong style={{ color: C.text }}>2. Uso dos dados</strong>{'\n'}
      Organização de jogos e treinos, estatísticas de presença e notificações. Não compartilhamos com terceiros.{'\n\n'}
      <strong style={{ color: C.text }}>3. Seus direitos (LGPD)</strong>{'\n'}
      Você pode corrigir seus dados no perfil e excluir sua conta a qualquer momento em Configurações.{'\n\n'}
      <strong style={{ color: C.text }}>4. Exclusão</strong>{'\n'}
      Ao excluir a conta, seus dados pessoais são anonimizados; o histórico de presenças e resultados é mantido de forma anônima.
    </>
  )
  return (
    <Overlay><div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full rounded-t-3xl flex flex-col" style={{ background: C.card, border: `1px solid ${C.bdr}`, maxHeight: '82%' }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${C.bdr}` }}>
          <div>
            <span className="f-mono font-bold rounded inline-block mb-1"
              style={{ fontSize: 9, padding: '2px 5px', background: C.yellow + '22', color: C.yellow, border: `1px solid ${C.yellow}44` }}>
              TEXTO PROVISÓRIO
            </span>
            <h3 className="f-sora font-black text-base" style={{ color: C.text }}>
              {type === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}
            </h3>
          </div>
          <button onClick={onClose} style={{ color: C.muted }}><IcoX size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <p className="f-mono text-xs leading-loose whitespace-pre-line" style={{ color: C.muted }}>
            {type === 'termos' ? termos : priv}
          </p>
        </div>
        <div className="p-4 shrink-0">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm active:scale-95"
            style={{ background: C.red, color: '#fff' }}>
            Entendido
          </button>
        </div>
      </div>
    </div></Overlay>
  )
}

// ─── Menu de demonstração ─────────────────────────────────────────────────────
const DEMO_OPCOES: { key: keyof DemoFlags; label: string; desc: string }[] = [
  { key: 'offline',     label: 'Modo offline',                       desc: 'Faixa de aviso e gravações bloqueadas (RNF19)' },
  { key: 'carregando',  label: 'Simular carregamento',               desc: 'Listas mostram o esqueleto ao abrir' },
  { key: 'erro',        label: 'Simular erro de conexão',            desc: 'Listas mostram "Tentar novamente"' },
  { key: 'notifNegada', label: 'Permissão de notificação negada',    desc: 'Aviso do Android nas notificações (UC12 A1)' },
]

export function DemoMenu({ demo, setDemo, onClose }:
  { demo: DemoFlags; setDemo: (f: (d: DemoFlags) => DemoFlags) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Demonstração</h3>
        <button onClick={onClose} style={{ color: C.muted }}><IcoX size={18} /></button>
      </div>
      <p className="f-mono text-[10px] mb-4" style={{ color: C.muted }}>Simula estados que não ocorrem na navegação normal do protótipo.</p>
      <div className="flex flex-col">
        {DEMO_OPCOES.map((o, i) => (
          <div key={o.key} className="flex items-center gap-3 py-3"
            style={{ borderTop: i > 0 ? `1px solid ${C.bdr}` : 'none' }}>
            <div className="flex-1">
              <p className="f-sora font-semibold text-sm" style={{ color: C.text }}>{o.label}</p>
              <p className="f-mono text-[10px]" style={{ color: C.muted }}>{o.desc}</p>
            </div>
            <Toggle on={demo[o.key]} onChange={() => setDemo(d => ({ ...d, [o.key]: !d[o.key] }))} />
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export function DemoButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="f-mono text-[10px] px-3 py-1.5 rounded-xl"
      style={{ background: C.card2, color: C.dim, border: `1px solid ${C.bdr}` }}>
      // Demo
    </button>
  )
}

// ─── Conteúdo de notícia: **negrito**, listas "- " e links [texto](url) ───────
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={`${keyBase}-${i++}`} style={{ color: C.text }}>{m[1]}</strong>)
    else out.push(<a key={`${keyBase}-${i++}`} href={m[3]} target="_blank" rel="noreferrer" style={{ color: C.blueL, textDecoration: 'underline' }}>{m[2]}</a>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let lista: string[] = []
  const flush = (k: number) => {
    if (!lista.length) return
    blocks.push(
      <ul key={`ul-${k}`} className="list-disc pl-5 mb-3 flex flex-col gap-1">
        {lista.map((li, j) => <li key={j}>{inline(li, `li-${k}-${j}`)}</li>)}
      </ul>
    )
    lista = []
  }
  text.split('\n').forEach((linha, k) => {
    if (linha.startsWith('- ')) { lista.push(linha.slice(2)); return }
    flush(k)
    if (linha.trim()) blocks.push(<p key={`p-${k}`} className="mb-3">{inline(linha, `p-${k}`)}</p>)
  })
  flush(-1)
  return <div className="f-mono text-xs leading-loose" style={{ color: C.muted }}>{blocks}</div>
}
