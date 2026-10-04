import type { PrismaService } from '../../infra/prisma/prisma.service'
import { AtleticaPadraoService } from './atletica-padrao.service'
import { ErroAtleticaPadrao } from './erros'

const ID = '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11'

function criarServico(atleticas: { id: string; nome: string }[], registro?: object) {
  const atletica = {
    findMany: jest.fn().mockResolvedValue(atleticas),
    findUniqueOrThrow: jest.fn().mockResolvedValue(registro),
  }
  const prisma = { db: { atletica } } as unknown as PrismaService
  return { servico: new AtleticaPadraoService(prisma), atletica }
}

describe('AtleticaPadraoService', () => {
  it('id() antes da inicialização lança erro', () => {
    expect(() => criarServico([]).servico.id()).toThrow('antes da inicialização')
  })

  it.each([
    ['nenhuma', []],
    [
      'duas',
      [
        { id: ID, nome: 'A' },
        { id: 'outro', nome: 'B' },
      ],
    ],
  ])('falha com %s atlética(s) usaAplicativo = true', async (_caso, atleticas) => {
    await expect(criarServico(atleticas).servico.onModuleInit()).rejects.toBeInstanceOf(
      ErroAtleticaPadrao,
    )
  })

  it('obter() lê a atlética padrão e descarta campos fora do contrato', async () => {
    const publica = {
      id: ID,
      nome: 'Atlética',
      sigla: null,
      curso: null,
      logoUrl: null,
      corPrimaria: null,
      corSecundaria: null,
      contatoEmail: null,
      contatoInstagram: null,
      contatoWhatsapp: null,
    }
    const { servico, atletica } = criarServico([{ id: ID, nome: 'Atlética' }], publica)
    await servico.onModuleInit()

    await expect(servico.obter()).resolves.toEqual(publica)
    expect(atletica.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID } }),
    )
  })
})
