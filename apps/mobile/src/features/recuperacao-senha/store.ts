import { create } from 'zustand'

/** Entre as telas do fluxo, e-mail e código só em memória, nunca na URL (épico #11 §6.1). */
type EstadoRecuperacao = {
  email: string
  codigo: string
  /** `Date.now()` do último envio: base do contador de expiração e da espera para reenviar. */
  enviadoEm: number | null
  iniciar: (email: string) => void
  codigoEnviado: (email: string) => void
  definirCodigo: (codigo: string) => void
  concluir: () => void
}

export const useRecuperacaoStore = create<EstadoRecuperacao>()((set) => ({
  email: '',
  codigo: '',
  enviadoEm: null,
  iniciar: (email) => set({ email, codigo: '', enviadoEm: null }),
  codigoEnviado: (email) => set({ email, codigo: '', enviadoEm: Date.now() }),
  definirCodigo: (codigo) => set({ codigo }),
  concluir: () => set({ codigo: '', enviadoEm: null }),
}))
