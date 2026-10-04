import type { AtleticaPublica } from '@atletica/shared'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { consultaAtletica, atleticaLidaPorCarregarAtletica } from './carregar-atletica'

export const COR_NEUTRA = '#6B7280'
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

/** O cache local entra como dado vencido; sem cache nem resposta, fallback neutro. */
export function useAtletica(): Atletica {
  const { data } = useQuery({
    ...consultaAtletica,
    initialData: atleticaLidaPorCarregarAtletica,
    initialDataUpdatedAt: 0,
  })
  return useMemo(() => resolverAtletica(data ?? null), [data])
}
