import {
  onlineManager,
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from '@/components/ui/toast'
import { ApiErro, CodigoLocal } from '@/infra/api/api-erro'
import { useOnline } from '@/infra/rede/online'

export const MENSAGEM_ACAO_OFFLINE = 'Sem conexão. Conecte-se à internet para concluir esta ação.'

export type AcaoOnline<TData, TError, TVariables, TContext> = UseMutationResult<
  TData,
  TError,
  TVariables,
  TContext
> & { online: boolean }

/**
 * Toda mutação passa por aqui (convenções §10.5). Offline, a `mutationFn` não é chamada e o
 * usuário vê o toast de sem conexão. Botões: `disabled={!online || isPending}`.
 */
export function useAcaoOnline<
  TData = unknown,
  TError = ApiErro,
  TVariables = void,
  TContext = unknown,
>(
  opcoes: UseMutationOptions<TData, TError, TVariables, TContext>,
): AcaoOnline<TData, TError, TVariables, TContext> {
  const online = useOnline()
  // 'always': uma ação nunca fica pausada para rodar sozinha quando a conexão voltar.
  const mutacao = useMutation({ ...opcoes, networkMode: 'always' })
  const { mutate: mutateOriginal, mutateAsync: mutateAsyncOriginal } = mutacao

  const mutate = useCallback(
    (...argumentos: Parameters<typeof mutateOriginal>) => {
      if (!onlineManager.isOnline()) {
        toast.erro(MENSAGEM_ACAO_OFFLINE)
        return
      }
      mutateOriginal(...argumentos)
    },
    [mutateOriginal],
  )

  const mutateAsync = useCallback(
    (...argumentos: Parameters<typeof mutateAsyncOriginal>) => {
      if (!onlineManager.isOnline()) {
        toast.erro(MENSAGEM_ACAO_OFFLINE)
        return Promise.reject(
          new ApiErro({ status: 0, code: CodigoLocal.SEM_CONEXAO, message: MENSAGEM_ACAO_OFFLINE }),
        )
      }
      return mutateAsyncOriginal(...argumentos)
    },
    [mutateAsyncOriginal],
  )

  return { ...mutacao, mutate, mutateAsync, online }
}
