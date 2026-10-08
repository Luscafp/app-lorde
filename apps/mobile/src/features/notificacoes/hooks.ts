import type { AtualizarPreferencias, Preferencias } from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { ehSessaoEncerrada, type ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { atualizarPreferencias, buscarPreferencias } from './api'

export const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.'

const MUTACAO = ['preferencias-notificacao'] as const

type Contexto = { anterior?: Partial<Preferencias> }

/** Só em memória (convenções §10.4). */
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
    mutationKey: MUTACAO,
    scope: { id: MUTACAO[0] },
    mutationFn: (dados) => atualizarPreferencias(dados),
    onMutate: async (dados) => {
      await cliente.cancelQueries({ queryKey: chave, exact: true })
      const atual = cliente.getQueryData<Preferencias>(chave)
      if (!atual) return {}
      cliente.setQueryData<Preferencias>(chave, { ...atual, ...dados })
      return { anterior: camposAnteriores(atual, dados) }
    },
    onError: (erro, _dados, contexto) => {
      if (contexto?.anterior) {
        cliente.setQueryData<Preferencias>(chave, (atual) =>
          atual ? { ...atual, ...contexto.anterior } : atual,
        )
      }
      if (!ehSessaoEncerrada(erro)) toast.erro(MENSAGEM_ERRO_SALVAR)
    },
    onSettled: () => {
      if (cliente.isMutating({ mutationKey: MUTACAO }) > 1) return
      void cliente.invalidateQueries({ queryKey: chave, exact: true })
    },
    meta: { toastProprio: true },
  })
}
