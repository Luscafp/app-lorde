import type { AtleticaPublica } from '@atletica/shared'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { consultaAtletica, lerAtleticaInicial } from './carregar-atletica'

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

/**
 * Marca da atlética, com fallback neutro enquanto não há cache nem resposta da API. O cache
 * local entra como dado vencido: a rede atualiza em segundo plano e de novo ao reconectar.
 */
export function useAtletica(): Atletica {
  const { data } = useQuery({
    ...consultaAtletica,
    initialData: lerAtleticaInicial,
    initialDataUpdatedAt: 0,
  })
  return useMemo(() => resolverAtletica(data ?? null), [data])
}
