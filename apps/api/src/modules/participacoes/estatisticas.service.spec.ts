import type { PrismaService } from '../../infra/prisma/prisma.service'
import { EstatisticasService, taxaPresenca } from './estatisticas.service'

const ATLETICA = 'a1a1a1a1-0000-4000-8000-000000000001'
const ANA = 'c1c1c1c1-0000-4000-8000-000000000001'

function criarServico(linhas: { jogos: bigint; treinos: bigint; chamadas: bigint }[]) {
  const $queryRaw = jest.fn().mockResolvedValue(linhas)
  const servico = new EstatisticasService({ db: { $queryRaw } } as unknown as PrismaService)
  return { servico, $queryRaw }
}

describe('taxaPresenca', () => {
  it.each([
    [0, 0, null],
    [0, 3, 0],
    [2, 3, 67],
    [1, 3, 33],
    [1, 2, 50],
    [3, 3, 100],
  ])('%i presenças em %i chamadas → %s', (presencas, chamadas, esperado) => {
    expect(taxaPresenca(presencas, chamadas)).toBe(esperado)
  })
})

describe('EstatisticasService.calcular', () => {
  it('separa jogos e treinos e soma os dois na taxa', async () => {
    const { servico } = criarServico([{ jogos: 1n, treinos: 1n, chamadas: 3n }])

    await expect(servico.calcular(ANA, ATLETICA)).resolves.toEqual({
      jogosParticipados: 1,
      treinosPresentes: 1,
      eventosComChamada: 3,
      taxaPresenca: 67,
    })
  })

  it('sem chamada: zeros e taxa null', async () => {
    const { servico } = criarServico([{ jogos: 0n, treinos: 0n, chamadas: 0n }])

    await expect(servico.calcular(ANA, ATLETICA)).resolves.toEqual({
      jogosParticipados: 0,
      treinosPresentes: 0,
      eventosComChamada: 0,
      taxaPresenca: null,
    })
  })

  it('filtra pelo usuário e pela atlética, sem cancelados nem excluídos', async () => {
    const { servico, $queryRaw } = criarServico([{ jogos: 0n, treinos: 0n, chamadas: 0n }])

    await servico.calcular(ANA, ATLETICA)

    const [partes, ...valores] = $queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    const sql = partes.join('?')
    expect(valores).toEqual([ANA, ATLETICA])
    expect(sql).toContain(`p."usuarioId" = ?::uuid AND p."atleticaId" = ?::uuid`)
    expect(sql).toContain(`e."status" <> 'CANCELADO' AND e."excluidoEm" IS NULL`)
    expect(sql).toContain(`FILTER (WHERE p."presente" AND e."tipo" = 'JOGO')`)
  })
})
