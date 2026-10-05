import type { Noticia, Prisma } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { proximaSequencia } from './sequencia'
import { criarUsuario } from './usuario'

export type DadosNoticia = Pick<Prisma.NoticiaUncheckedCreateInput, 'atleticaId'> &
  Partial<Prisma.NoticiaUncheckedCreateInput>

/**
 * Cria uma notícia publicada agora, com título único e autor DIRETOR da mesma atlética.
 * `status: 'RASCUNHO'` sem `publicadaEm` cria um rascunho (`CHECK noticia_publicada_com_data`).
 */
export async function criarNoticia(dados: DadosNoticia): Promise<Noticia> {
  const n = proximaSequencia()
  const status = dados.status ?? 'PUBLICADA'
  const autorId =
    dados.autorId ?? (await criarUsuario({ papel: 'DIRETOR', atleticaId: dados.atleticaId })).id

  return prismaTeste.noticia.create({
    data: {
      titulo: `Notícia ${n}`,
      conteudo: `Conteúdo da notícia ${n}.`,
      publicadaEm: status === 'PUBLICADA' ? new Date() : null,
      ...dados,
      status,
      autorId,
    },
  })
}
