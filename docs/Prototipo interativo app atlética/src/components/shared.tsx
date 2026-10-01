import { useEffect } from 'react'
import { C } from '../theme'
import type { ToastItem, ConfirmState } from '../types'
import { IcoAlert, IcoRefresh, IcoWifi, IcoX, IcoCheck } from './atoms'

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
  { icon?: React.ReactNode; message: string; action?: string; onAction?: () => void }) {
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

// ─── Offline banner ───────────────────────────────────────────────────────────
export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2"
      style={{ background: '#f97316', zIndex: 50 }}>
      <IcoWifi size={14} color="#fff" />
      <p className="f-mono text-[11px] font-medium text-white">
        Você está offline — exibindo os últimos dados
      </p>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastItem_({ item }: { item: ToastItem }) {
  const isSuccess = item.type === 'success'
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl a-pop"
      style={{
        background: isSuccess ? C.green + '22' : '#f43f5e22',
        border: `1px solid ${isSuccess ? C.green + '44' : 'rgba(244,63,94,.4)'}`,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      }}>
      {isSuccess
        ? <IcoCheck size={16} color={C.green} />
        : <IcoX size={16} color="#f43f5e" />}
      <span className="f-sora font-medium text-sm" style={{ color: C.text }}>
        {item.message}
      </span>
    </div>
  )
}

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="absolute bottom-24 left-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map(t => <ToastItem_ key={t.id} item={t} />)}
    </div>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
export function ConfirmModal({ state, onCancel }:
  { state: ConfirmState; onCancel: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    if (state) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, onCancel])

  if (!state) return null

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-6 flex flex-col gap-4 a-up"
        style={{ background: C.s1, border: `1px solid ${C.bdr}`, borderBottom: 'none' }}>
        <div>
          <h3 className="f-sora font-black text-lg" style={{ color: C.text }}>{state.title}</h3>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: C.muted }}>{state.message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>
            Cancelar
          </button>
          <button onClick={() => { state.onConfirm(); onCancel() }}
            className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm active:scale-95"
            style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.4)' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
