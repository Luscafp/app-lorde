import type { AtualizarPreferencias, Preferencias } from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { atualizarPreferencias, buscarPreferencias } from './api'

export const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.'

const CHAVE_MUTACAO = ['preferencias-notificacao'] as const

type Contexto = { anterior?: Partial<Preferencias> }

export function usePreferencias() {
  return useQuery({
    queryKey: chaves.me.preferencias(),
    queryFn: ({ signal }) => buscarPreferencias(signal),
  })
}

function camposAnteriores(atual: Preferencias, dados: AtualizarPreferencias) {
  const chavesAlteradas = Object.keys(dados) as (keyof Preferencias)[]
  return Object.fromEntries(chavesAlteradas.map((chave) => [chave, atual[chave]]))
}

/**
 * Otimista por campo; o `scope` enfileira os PATCHs e só o último da fila relê o servidor,
 * para uma resposta antiga não desfazer um toque mais recente.
 */
export function useAtualizarPreferencia() {
  const cliente = useQueryClient()
  const chave = chaves.me.preferencias()

  return useAcaoOnline<Preferencias, ApiErro, AtualizarPreferencias, Contexto>({
    mutationKey: CHAVE_MUTACAO,
    scope: { id: CHAVE_MUTACAO[0] },
    mutationFn: (dados) => atualizarPreferencias(dados),
    onMutate: async (dados) => {
      await cliente.cancelQueries({ queryKey: chave, exact: true })
      const atual = cliente.getQueryData<Preferencias>(chave)
      if (!atual) return {}
      cliente.setQueryData<Preferencias>(chave, { ...atual, ...dados })
      return { anterior: camposAnteriores(atual, dados) }
    },
    onError: (_erro, _dados, contexto) => {
      if (!contexto?.anterior) return
      cliente.setQueryData<Preferencias>(chave, (atual) =>
        atual ? { ...atual, ...contexto.anterior } : atual,
      )
    },
    onSettled: () => {
      if (cliente.isMutating({ mutationKey: CHAVE_MUTACAO }) > 1) return
      void cliente.invalidateQueries({ queryKey: chave, exact: true })
    },
    meta: { mensagemErro: MENSAGEM_ERRO_SALVAR },
  })
}
