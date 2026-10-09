import {
  respostaEnvioVerificacaoSchema,
  respostaVerificarEmailSchema,
  type RespostaEnvioVerificacao,
  type RespostaVerificarEmail,
  type VerificarEmailEntrada,
} from '@atletica/shared'
import { useQueryClient } from '@tanstack/react-query'
import { CodigoApi, type ApiErro } from '@/infra/api/api-erro'
import { api } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { useVerificacaoEmailStore } from './store'

/** `details` do `429`: `[{ field: 'proximoEnvioEm', message: '<ISO>' }]`. */
export function proximoEnvioDoErro(erro: ApiErro): number | null {
  const detalhe = erro.details.find(({ field }) => field === 'proximoEnvioEm')
  const instante = detalhe ? Date.parse(detalhe.message) : NaN
  if (!Number.isNaN(instante)) return instante
  return erro.segundosParaNovaTentativa === null
    ? null
    : Date.now() + erro.segundosParaNovaTentativa * 1000
}

export function useReenviarCodigo() {
  const cliente = useQueryClient()
  const definirProximoEnvio = useVerificacaoEmailStore((estado) => estado.definirProximoEnvio)
  return useAcaoOnline<RespostaEnvioVerificacao, ApiErro, void>({
    mutationFn: async () =>
      respostaEnvioVerificacaoSchema.parse(await api.post('/auth/verificar-email/enviar')),
    onSuccess: ({ proximoEnvioEm }) => definirProximoEnvio(Date.parse(proximoEnvioEm)),
    onError: (erro) => {
      const proximo = erro.code === CodigoApi.RATE_LIMITED ? proximoEnvioDoErro(erro) : null
      if (proximo !== null) definirProximoEnvio(proximo)
      if (erro.code === CodigoApi.EMAIL_JA_VERIFICADO) {
        void cliente.invalidateQueries({ queryKey: chaves.me(), exact: true })
      }
    },
    meta: { errosNaTela: [CodigoApi.RATE_LIMITED, CodigoApi.EMAIL_JA_VERIFICADO] },
  })
}

export function useVerificarEmail() {
  const cliente = useQueryClient()
  return useAcaoOnline<RespostaVerificarEmail, ApiErro, VerificarEmailEntrada>({
    mutationFn: async (dados) =>
      respostaVerificarEmailSchema.parse(await api.post('/auth/verificar-email', dados)),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.me(), exact: true }),
    meta: { errosNaTela: [CodigoApi.CODIGO_INVALIDO, CodigoApi.CODIGO_EXPIRADO] },
  })
}
