import type { CadastroEntrada } from '@atletica/shared'
import { toast } from '@/components/ui/toast'
import { CodigoApi } from '@/infra/api/api-erro'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'
import { cadastrar } from './api'

export const MENSAGEM_CONTA_CRIADA = 'Conta criada com sucesso'

export function useCadastro() {
  return useAcaoOnline({
    mutationFn: (dados: CadastroEntrada) => cadastrar(dados),
    onSuccess: async (resposta) => {
      await useSessao.getState().iniciarSessao(resposta)
      toast.sucesso(MENSAGEM_CONTA_CRIADA)
    },
    meta: { errosNaTela: [CodigoApi.EMAIL_JA_CADASTRADO] },
  })
}
