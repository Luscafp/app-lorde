import { onlineManager } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { ApiErro, ehErroTransitorio } from '@/infra/api/api-erro'
import {
  adicionarLogoutPendente,
  listarLogoutPendente,
  removerLogoutPendente,
} from '@/infra/sessao/logout-pendente'
import { useSessao } from '@/infra/sessao/store'
import { revogarSessao } from './api'

export const TEMPO_LIMITE_LOGOUT_MS = 5_000
export const MENSAGEM_SESSAO_ENCERRADA = 'Sessão encerrada'

let processamento: Promise<void> | null = null

/** `true` quando a API respondeu: `204`, ou um `4xx` que não muda com nova tentativa. */
async function revogarNoServidor(refreshToken: string): Promise<boolean> {
  if (!onlineManager.isOnline()) return false
  const controle = new AbortController()
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_LOGOUT_MS)
  try {
    await revogarSessao(refreshToken, controle.signal)
    return true
  } catch (erro) {
    return erro instanceof ApiErro && !ehErroTransitorio(erro)
  } finally {
    clearTimeout(limite)
  }
}

/** UC08: sem resposta da API o token vai para `logoutPendente`; a sessão local sempre termina. */
export async function sair(): Promise<void> {
  const { refreshToken } = useSessao.getState()
  if (refreshToken && !(await revogarNoServidor(refreshToken))) {
    await adicionarLogoutPendente(refreshToken)
  }
  await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
  toast.sucesso(MENSAGEM_SESSAO_ENCERRADA)
}

async function executarProcessamento(): Promise<void> {
  for (const refreshToken of await listarLogoutPendente()) {
    if (!(await revogarNoServidor(refreshToken))) return
    await removerLogoutPendente(refreshToken)
  }
}

export function processarLogoutPendente(): Promise<void> {
  processamento ??= executarProcessamento().finally(() => {
    processamento = null
  })
  return processamento
}

/** Processa no start do app e a cada volta da conexão. Devolve o cancelamento. */
export function acompanharLogoutPendente(): () => void {
  void processarLogoutPendente()
  return onlineManager.subscribe((online) => {
    if (online) void processarLogoutPendente()
  })
}
