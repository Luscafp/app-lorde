import type { Prisma, SolicitacaoEntrada, Time, Usuario } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'

export type DadosSolicitacao = Partial<
  Pick<
    Prisma.SolicitacaoEntradaUncheckedCreateInput,
    'status' | 'criadaEm' | 'avaliadaEm' | 'avaliadoPorId' | 'canceladaEm'
  >
>

/** Solicitação `PENDENTE` por padrão; `APROVADA`/`REJEITADA` preenchem `avaliadaEm` (CHECK). */
export function criarSolicitacao(
  time: Pick<Time, 'id' | 'atleticaId'>,
  usuario: Pick<Usuario, 'id'>,
  dados: DadosSolicitacao = {},
): Promise<SolicitacaoEntrada> {
  const avaliada = dados.status === 'APROVADA' || dados.status === 'REJEITADA'
  const cancelada = dados.status === 'CANCELADA'
  return prismaTeste.solicitacaoEntrada.create({
    data: {
      atleticaId: time.atleticaId,
      timeId: time.id,
      usuarioId: usuario.id,
      avaliadaEm: avaliada ? new Date() : undefined,
      canceladaEm: cancelada ? new Date() : undefined,
      ...dados,
    },
  })
}
