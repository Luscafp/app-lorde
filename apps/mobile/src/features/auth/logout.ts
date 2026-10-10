import { onlineManager } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { esquecerDispositivo, removerDispositivo } from '@/features/notificacoes/registro-push'
import { ApiErro, CodigoApi, ehErroTransitorio } from '@/infra/api/api-erro'
import { comTempoLimite } from '@/infra/com-tempo-limite'
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
async function revogarNoServidor(refreshToken: string, sinal: AbortSignal): Promise<boolean> {
  if (!onlineManager.isOnline()) return false
  try {
    await revogarSessao(refreshToken, sinal)
    return true
  } catch (erro) {
    return ehRespostaDefinitiva(erro)
  }
}

async function revogarOuGuardar(refreshToken: string, sinal: AbortSignal): Promise<void> {
  if (!(await revogarNoServidor(refreshToken, sinal))) await adicionarLogoutPendente(refreshToken)
}

async function desvincularAparelho(sinal: AbortSignal): Promise<void> {
  await (onlineManager.isOnline() ? removerDispositivo(sinal) : esquecerDispositivo())
}

/** UC08: sem resposta da API o token vai para `logoutPendente`; a sessão local sempre termina. */
export async function sair(): Promise<void> {
  const { refreshToken } = useSessao.getState()
  await comTempoLimite(TEMPO_LIMITE_LOGOUT_MS, async (sinal) => {
    await desvincularAparelho(sinal).catch(() => undefined)
    if (refreshToken) await revogarOuGuardar(refreshToken, sinal).catch(() => undefined)
  })
  await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
  toast.sucesso(MENSAGEM_SESSAO_ENCERRADA)
}

async function executarProcessamento(): Promise<void> {
  for (const refreshToken of await listarLogoutPendente()) {
    const revogado = await comTempoLimite(TEMPO_LIMITE_LOGOUT_MS, (sinal) =>
      revogarNoServidor(refreshToken, sinal),
    )
    if (!revogado) return
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
