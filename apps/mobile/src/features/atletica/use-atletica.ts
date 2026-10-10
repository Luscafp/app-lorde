import type { AtleticaPublica } from '@atletica/shared'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { COR_NEUTRA } from '@/config/tema'
import {
  atleticaLidaPorCarregarAtletica,
  atleticaLidaSalvaEm,
  consultaAtletica,
} from './carregar-atletica'

export { COR_NEUTRA }
export const NOME_GENERICO = 'Atlética'

export type Atletica = Omit<AtleticaPublica, 'id' | 'corPrimaria' | 'corSecundaria'> & {
  id: string | null
  corPrimaria: string
  corSecundaria: string
}

function resolverAtletica(dados: AtleticaPublica | null): Atletica {
  return {
    id: dados?.id ?? null,
    nome: dados?.nome ?? NOME_GENERICO,
    sigla: dados?.sigla ?? null,
    curso: dados?.curso ?? null,
    logoUrl: dados?.logoUrl ?? null,
    corPrimaria: dados?.corPrimaria ?? COR_NEUTRA,
    corSecundaria: dados?.corSecundaria ?? COR_NEUTRA,
    contatoEmail: dados?.contatoEmail ?? null,
    contatoInstagram: dados?.contatoInstagram ?? null,
    contatoWhatsapp: dados?.contatoWhatsapp ?? null,
  }
}

/** O cache local entra com a data em que foi salvo, que a faixa offline exibe. */
export function useConsultaAtletica() {
  return useQuery({
    ...consultaAtletica,
    initialData: atleticaLidaPorCarregarAtletica,
    initialDataUpdatedAt: atleticaLidaSalvaEm,
  })
}

/** Sem cache nem resposta, fallback neutro. */
export function useAtletica(): Atletica {
  const { data } = useConsultaAtletica()
  return useMemo(() => resolverAtletica(data ?? null), [data])
}
