import { onlineManager } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { ApiErro, CodigoApi, ehErroTransitorio } from '@/infra/api/api-erro'
import { execucaoUnica } from '@/infra/execucao-unica'
import {
  adicionarLogoutPendente,
  listarLogoutPendente,
  removerLogoutPendente,
} from '@/infra/sessao/logout-pendente'
import { useSessao } from '@/infra/sessao/store'
import { revogarSessao } from './api'

export const TEMPO_LIMITE_LOGOUT_MS = 5_000
export const MENSAGEM_SESSAO_ENCERRADA = 'Sessão encerrada'

function ehRespostaDefinitiva(erro: unknown): boolean {
  return erro instanceof ApiErro && !ehErroTransitorio(erro) && erro.code !== CodigoApi.RATE_LIMITED
}

/** `true` quando a API respondeu: `204`, ou um `4xx` que não muda com nova tentativa. */
async function revogarNoServidor(refreshToken: string): Promise<boolean> {
  if (!onlineManager.isOnline()) return false
  const controle = new AbortController()
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_LOGOUT_MS)
  try {
    await revogarSessao(refreshToken, controle.signal)
    return true
  } catch (erro) {
    return ehRespostaDefinitiva(erro)
  } finally {
    clearTimeout(limite)
  }
}

async function revogarOuGuardar(refreshToken: string): Promise<void> {
  if (!(await revogarNoServidor(refreshToken))) await adicionarLogoutPendente(refreshToken)
}

/** UC08: sem resposta da API o token vai para `logoutPendente`; a sessão local sempre termina. */
export async function sair(): Promise<void> {
  const { refreshToken } = useSessao.getState()
  if (refreshToken) await revogarOuGuardar(refreshToken).catch(() => undefined)
  await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
  toast.sucesso(MENSAGEM_SESSAO_ENCERRADA)
}

async function executarProcessamento(): Promise<void> {
  for (const refreshToken of await listarLogoutPendente()) {
    if (!(await revogarNoServidor(refreshToken))) return
    await removerLogoutPendente(refreshToken)
  }
}

export const processarLogoutPendente = execucaoUnica(executarProcessamento)

/** Processa no start do app e a cada volta da conexão; uma falha fica para o próximo gatilho. */
export function acompanharLogoutPendente(): void {
  const processar = () => void processarLogoutPendente().catch(() => undefined)
  processar()
  onlineManager.subscribe((online) => {
    if (online) processar()
  })
}
