import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { UploadsService } from '../uploads/uploads.service'
import { NoticiasPublicasService } from './noticias-publicas.service'

const ID = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const PUBLICADA_EM = new Date('2026-09-28T18:00:00.000Z')
const NOTICIA = {
  id: ID,
  titulo: 'Campeões',
  conteudo: 'A equipe **venceu** a final.',
  imagemCapaKey: 'atleticas/a/noticias/u/capa.jpg',
  publicadaEm: PUBLICADA_EM,
}
const VISIVEL = { status: 'PUBLICADA', excluidoEm: null }

function criarServico() {
  const db = {
    noticia: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  }
  const uploads = {
    urlPublica: jest.fn((key: string | null) => (key ? `https://img.teste/${key}` : null)),
  }
  const servico = new NoticiasPublicasService(
    { db } as unknown as PrismaService,
    uploads as unknown as UploadsService,
  )
  return { servico, db }
}

describe('NoticiasPublicasService', () => {
  describe('listar', () => {
    it('filtra publicadas não excluídas, ordena, pagina e monta resumo e URL', async () => {
      const { servico, db } = criarServico()
      db.noticia.findMany.mockResolvedValue([NOTICIA, { ...NOTICIA, imagemCapaKey: null }])
      db.noticia.count.mockResolvedValue(45)

      const resposta = await servico.listar({ page: 3, limit: 20 })

      expect(db.noticia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: VISIVEL,
          orderBy: [{ publicadaEm: 'desc' }, { id: 'desc' }],
          skip: 40,
          take: 20,
        }),
      )
      expect(db.noticia.count).toHaveBeenCalledWith({ where: VISIVEL })
      expect(resposta).toEqual({
        items: [
          {
            id: ID,
            titulo: 'Campeões',
            imagemCapaUrl: 'https://img.teste/atleticas/a/noticias/u/capa.jpg',
            publicadaEm: '2026-09-28T18:00:00.000Z',
            resumo: 'A equipe venceu a final.',
          },
          expect.objectContaining({ imagemCapaUrl: null }),
        ],
        page: 3,
        limit: 20,
        total: 45,
      })
    })
  })

  describe('detalhar', () => {
    it('devolve o conteúdo em Markdown bruto', async () => {
      const { servico, db } = criarServico()
      db.noticia.findFirst.mockResolvedValue(NOTICIA)

      await expect(servico.detalhar(ID)).resolves.toEqual({
        id: ID,
        titulo: 'Campeões',
        conteudo: 'A equipe **venceu** a final.',
        imagemCapaUrl: 'https://img.teste/atleticas/a/noticias/u/capa.jpg',
        publicadaEm: '2026-09-28T18:00:00.000Z',
      })
      expect(db.noticia.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, ...VISIVEL } }),
      )
    })

    it('não encontrada → 404 NOT_FOUND', async () => {
      const { servico, db } = criarServico()
      db.noticia.findFirst.mockResolvedValue(null)
      await expect(servico.detalhar(ID)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      })
    })

    it('publicada sem publicadaEm viola o CHECK e vira erro interno', async () => {
      const { servico, db } = criarServico()
      db.noticia.findFirst.mockResolvedValue({ ...NOTICIA, publicadaEm: null })
      await expect(servico.detalhar(ID)).rejects.toThrow('sem publicadaEm')
    })
  })
})
