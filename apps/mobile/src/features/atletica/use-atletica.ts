import type { AtleticaPublica } from '@atletica/shared'
import { useMemo } from 'react'
import { atleticaStore } from './carregar-atletica'

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

/** Marca da atlética, com fallback neutro enquanto não há cache nem resposta da API. */
export function useAtletica(): Atletica {
  const dados = atleticaStore((estado) => estado.dados)
  return useMemo(() => resolverAtletica(dados), [dados])
}
