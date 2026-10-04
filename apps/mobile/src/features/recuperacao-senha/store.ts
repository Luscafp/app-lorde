import { create } from 'zustand'

/** E-mail e código só em memória, nunca na URL (épico #11 §6.1). */
type EstadoRecuperacao = {
  email: string
  codigo: string
  /** `Date.now()` do último envio: base do contador de expiração e da espera para reenviar. */
  enviadoEm: number | null
  /** E-mail para o login vir preenchido depois da redefinição (#59 consome). */
  emailLogin: string | null
  iniciar: (email: string) => void
  codigoEnviado: (email: string) => void
  definirCodigo: (codigo: string) => void
  concluir: () => void
  consumirEmailLogin: () => string | null
}

export const useRecuperacaoStore = create<EstadoRecuperacao>()((set, get) => ({
  email: '',
  codigo: '',
  enviadoEm: null,
  emailLogin: null,
  iniciar: (email) => set({ email, codigo: '', enviadoEm: null }),
  codigoEnviado: (email) => set({ email, codigo: '', enviadoEm: Date.now() }),
  definirCodigo: (codigo) => set({ codigo }),
  concluir: () => set(({ email }) => ({ codigo: '', enviadoEm: null, emailLogin: email })),
  consumirEmailLogin: () => {
    const { emailLogin } = get()
    set({ emailLogin: null })
    return emailLogin
  },
}))
