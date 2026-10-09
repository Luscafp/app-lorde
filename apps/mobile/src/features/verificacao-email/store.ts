import { create } from 'zustand'
import { ESPERA_REENVIO_MS } from '@/features/recuperacao-senha'
import { aoEncerrarSessao } from '@/infra/sessao/store'

type EstadoVerificacao = {
  /** E-mail do aviso pós-cadastro na Home; exibido uma vez por cadastro. */
  avisoPara: string | null
  /** `Date.now()` a partir do qual o reenvio é permitido. */
  proximoEnvioEm: number | null
  registrarCadastro: (email: string) => void
  dispensarAviso: () => void
  definirProximoEnvio: (instante: number) => void
}

const INICIAL = { avisoPara: null, proximoEnvioEm: null }

export const useVerificacaoEmailStore = create<EstadoVerificacao>()((set) => ({
  ...INICIAL,
  registrarCadastro: (email) =>
    set({ avisoPara: email, proximoEnvioEm: Date.now() + ESPERA_REENVIO_MS }),
  dispensarAviso: () => set({ avisoPara: null }),
  definirProximoEnvio: (proximoEnvioEm) => set({ proximoEnvioEm }),
}))

aoEncerrarSessao(() => useVerificacaoEmailStore.setState(INICIAL))
