import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService, EntradaAuditoria } from '../auditoria/auditoria.service'
import type { UploadsService } from '../uploads/uploads.service'
import { NoticiasPainelService } from './noticias-painel.service'

const callbacksAposCommit: (() => unknown)[] = []

jest.mock('../../infra/eventos/apos-commit', () => ({
  aposCommit: (callback: () => unknown) => callbacksAposCommit.push(callback),
}))

const ID = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const ATLETICA_ID = '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const DIRETOR = { id: '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90', atleticaId: ATLETICA_ID }
const CAPA = `atleticas/${ATLETICA_ID}/noticias/${DIRETOR.id}/capa.jpg`
const CAPA_NOVA = `atleticas/${ATLETICA_ID}/noticias/${DIRETOR.id}/nova.jpg`
const PUBLICADA_EM = new Date('2026-09-30T12:00:00.000Z')
const DATA = new Date('2026-09-29T18:00:00.000Z')

type Linha = {
  id: string
  titulo: string
  conteudo: string
  imagemCapaKey: string | null
  status: 'RASCUNHO' | 'PUBLICADA'
  publicadaEm: Date | null
  criadoEm: Date
  atualizadoEm: Date
  autor: { id: string; nome: string }
}

function linha(parcial: Partial<Linha> = {}): Linha {
  return {
    id: ID,
    titulo: 'Seletiva de futsal',
    conteudo: 'Inscrições até **sexta**.',
    imagemCapaKey: CAPA,
    status: 'RASCUNHO',
    publicadaEm: null,
    criadoEm: DATA,
    atualizadoEm: DATA,
    autor: { id: DIRETOR.id, nome: 'Maria' },
    ...parcial,
  }
}

function criarServico(atual: Linha | null = linha()) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(atual ? [{ id: ID }] : []),
    noticia: {
      create: jest.fn(({ data }: { data: Partial<Linha> }) => Promise.resolve(linha(data))),
      update: jest.fn(({ data }: { data: Partial<Linha> }) =>
        Promise.resolve(linha({ ...atual, ...data })),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(atual),
    },
  }
  const db = {
    $queryRaw: jest.fn(),
    noticia: { findMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(atual) },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn() }
  const eventos = { emitirAposCommit: jest.fn() }
  const uploads = {
    urlPublica: jest.fn((key: string | null) => key && `https://img/${key}`),
    validarKey: jest.fn(),
    remover: jest.fn(),
  }
  const servico = new NoticiasPainelService(
    { db } as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    eventos as unknown as EventosDominioService,
    uploads as unknown as UploadsService,
  )
  const entradas = () => auditoria.registrar.mock.calls as [unknown, EntradaAuditoria][]
  const acoes = () => entradas().map(([, { acao }]) => acao)
  const dadosAuditados = () => entradas()[0]?.[1].dados
  const dadosDoUpdateMany = () =>
    (tx.noticia.updateMany.mock.calls as [{ data: Partial<Linha> }][])[0]?.[0].data ?? {}
  return {
    servico,
    tx,
    db,
    transacao,
    auditoria,
    eventos,
    uploads,
    acoes,
    dadosAuditados,
    dadosDoUpdateMany,
  }
}

beforeEach(() => {
  callbacksAposCommit.length = 0
})

describe('NoticiasPainelService', () => {
  describe('listar', () => {
    it('pagina em SQL e devolve itens sem conteúdo, na ordem dos ids', async () => {
      const { servico, db } = criarServico()
      const outra = linha({ id: 'outra', imagemCapaKey: null, status: 'PUBLICADA' })
      db.$queryRaw.mockResolvedValueOnce([{ id: 'outra' }, { id: ID }])
      db.$queryRaw.mockResolvedValueOnce([{ total: 12n }])
      db.noticia.findMany.mockResolvedValue([linha({ publicadaEm: PUBLICADA_EM }), outra])

      const resposta = await servico.listar(ATLETICA_ID, {
        page: 2,
        limit: 10,
        status: 'RASCUNHO',
        q: '50%',
      })

      expect(resposta).toMatchObject({ page: 2, limit: 10, total: 12 })
      expect(resposta.items.map(({ id }) => id)).toEqual(['outra', ID])
      expect(resposta.items[0]).not.toHaveProperty('conteudo')
      expect(resposta.items[1]).toMatchObject({
        imagemCapaUrl: `https://img/${CAPA}`,
        publicadaEm: '2026-09-30T12:00:00.000Z',
        autor: { id: DIRETOR.id, nome: 'Maria' },
      })
      const valores = db.$queryRaw.mock.calls.flatMap(
        ([, sql]: [unknown, { values: unknown[] }]) => sql.values,
      )
      expect(valores).toEqual(expect.arrayContaining([ATLETICA_ID, 'RASCUNHO', '%50\\%%']))
    })
  })

  describe('detalhar', () => {
    it('não excluída, com conteúdo', async () => {
      const { servico, db } = criarServico()
      await expect(servico.detalhar(ID)).resolves.toMatchObject({
        id: ID,
        conteudo: 'Inscrições até **sexta**.',
        status: 'RASCUNHO',
        publicadaEm: null,
      })
      expect(db.noticia.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, excluidoEm: null } }),
      )
    })

    it('não encontrada → 404', async () => {
      const { servico } = criarServico(null)
      await expect(servico.detalhar(ID)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      })
    })
  })

  describe('criar', () => {
    it('rascunho mínimo: conteúdo vazio, sem capa, sem evento', async () => {
      const { servico, tx, auditoria, eventos, uploads } = criarServico()

      const criada = await servico.criar(DIRETOR, { titulo: 'Seletiva' })

      expect(tx.noticia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            titulo: 'Seletiva',
            conteudo: '',
            imagemCapaKey: null,
            atleticaId: ATLETICA_ID,
            autorId: DIRETOR.id,
          },
        }),
      )
      expect(criada).toMatchObject({ status: 'RASCUNHO', publicadaEm: null })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_CRIADA',
        entidadeId: ID,
        dados: { antes: null, depois: { titulo: 'Seletiva', status: 'RASCUNHO' } },
      })
      expect(uploads.validarKey).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('já publicada: valida a capa, audita criação e publicação e emite o evento', async () => {
      const { servico, tx, acoes, eventos, uploads, dadosAuditados } = criarServico()

      const criada = await servico.criar(DIRETOR, {
        titulo: 'Seletiva',
        conteudo: 'Texto',
        imagemCapaKey: CAPA,
        publicar: true,
      })

      expect(uploads.validarKey).toHaveBeenCalledWith({
        key: CAPA,
        finalidade: 'NOTICIA',
        usuarioId: DIRETOR.id,
        atleticaId: ATLETICA_ID,
      })
      expect(tx.noticia.create.mock.calls[0]?.[0].data).toMatchObject({
        status: 'PUBLICADA',
        publicadaEm: expect.any(Date) as Date,
      })
      expect(criada.status).toBe('PUBLICADA')
      expect(acoes()).toEqual(['NOTICIA_CRIADA', 'NOTICIA_PUBLICADA'])
      expect(dadosAuditados()).toEqual({
        antes: null,
        depois: { titulo: 'Seletiva', status: 'PUBLICADA' },
      })
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('noticia.publicada', {
        atleticaId: ATLETICA_ID,
        noticiaId: ID,
        autorId: DIRETOR.id,
      })
    })

    it.each([
      [{ conteudo: 'Texto' }, 'CAPA_OBRIGATORIA'],
      [{ conteudo: '  \n ', imagemCapaKey: CAPA }, 'CONTEUDO_OBRIGATORIO'],
      [{ imagemCapaKey: CAPA }, 'CONTEUDO_OBRIGATORIO'],
    ])('publicar sem requisitos %j → 422 %s, sem gravar', async (dados, code) => {
      const { servico, tx, uploads } = criarServico()
      await expect(
        servico.criar(DIRETOR, { titulo: 'Seletiva', publicar: true, ...dados }),
      ).rejects.toMatchObject({ statusCode: 422, code })
      expect(uploads.validarKey).not.toHaveBeenCalled()
      expect(tx.noticia.create).not.toHaveBeenCalled()
    })

    it('capa inválida interrompe antes de abrir a transação', async () => {
      const { servico, tx, uploads } = criarServico()
      uploads.validarKey.mockRejectedValue(new Error('UPLOAD_INVALIDO'))
      await expect(
        servico.criar(DIRETOR, { titulo: 'Seletiva', imagemCapaKey: CAPA }),
      ).rejects.toThrow('UPLOAD_INVALIDO')
      expect(tx.noticia.create).not.toHaveBeenCalled()
    })
  })

  describe('atualizar', () => {
    it('só o título: audita só o título, sem validar a capa', async () => {
      const { servico, tx, auditoria, uploads } = criarServico()

      const atualizada = await servico.atualizar(ID, DIRETOR, { titulo: 'Novo título' })

      expect(atualizada.titulo).toBe('Novo título')
      expect(uploads.validarKey).not.toHaveBeenCalled()
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_ALTERADA',
        entidadeId: ID,
        dados: {
          antes: { titulo: 'Seletiva de futsal' },
          depois: { titulo: 'Novo título' },
        },
      })
      expect(callbacksAposCommit).toHaveLength(0)
    })

    it('mesma chave da capa (outro autor): não chama validarKey (critério 19)', async () => {
      const { servico, uploads, dadosAuditados } = criarServico()
      await servico.atualizar(
        ID,
        { ...DIRETOR, id: 'outro-diretor' },
        {
          conteudo: 'Outro texto',
          imagemCapaKey: CAPA,
        },
      )
      expect(uploads.validarKey).not.toHaveBeenCalled()
      expect(dadosAuditados()).toEqual({
        antes: {},
        depois: { conteudoAlterado: true },
      })
    })

    it('troca a capa: valida a nova fora da transação e remove a antiga depois do commit', async () => {
      const { servico, transacao, uploads, dadosAuditados } = criarServico()

      await servico.atualizar(ID, DIRETOR, { imagemCapaKey: CAPA_NOVA })

      expect(uploads.validarKey).toHaveBeenCalledTimes(1)
      expect(uploads.validarKey).toHaveBeenCalledWith(
        expect.objectContaining({ key: CAPA_NOVA, finalidade: 'NOTICIA' }),
      )
      expect(uploads.validarKey.mock.invocationCallOrder[0]).toBeLessThan(
        transacao.executar.mock.invocationCallOrder[0] ?? 0,
      )
      expect(dadosAuditados()).toEqual({
        antes: {},
        depois: { capaAlterada: true },
      })
      expect(uploads.remover).not.toHaveBeenCalled()
      await Promise.all(callbacksAposCommit.map((callback) => callback()))
      expect(uploads.remover).toHaveBeenCalledWith(CAPA)
    })

    it('remove a capa do rascunho sem validar', async () => {
      const { servico, uploads } = criarServico()
      const atualizada = await servico.atualizar(ID, DIRETOR, { imagemCapaKey: null })
      expect(atualizada.imagemCapaUrl).toBeNull()
      expect(uploads.validarKey).not.toHaveBeenCalled()
      expect(callbacksAposCommit).toHaveLength(1)
    })

    it('sem mudança: não grava nem audita', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.atualizar(ID, DIRETOR, { titulo: 'Seletiva de futsal' })
      expect(tx.noticia.update).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it.each([
      [{ imagemCapaKey: null }, 'CAPA_OBRIGATORIA'],
      [{ conteudo: '   ' }, 'CONTEUDO_OBRIGATORIO'],
    ])('publicada %j → 422 %s (critério 6)', async (dados, code) => {
      const publicada = linha({ status: 'PUBLICADA', publicadaEm: PUBLICADA_EM })
      const { servico, tx } = criarServico(publicada)
      await expect(servico.atualizar(ID, DIRETOR, dados)).rejects.toMatchObject({
        statusCode: 422,
        code,
      })
      expect(tx.noticia.update).not.toHaveBeenCalled()
    })

    it('publicada: mantém status e publicadaEm, sem evento (critério 5)', async () => {
      const publicada = linha({ status: 'PUBLICADA', publicadaEm: PUBLICADA_EM })
      const { servico, tx, eventos } = criarServico(publicada)
      const atualizada = await servico.atualizar(ID, DIRETOR, { titulo: 'Corrigido' })
      expect(tx.noticia.update.mock.calls[0]?.[0].data).not.toHaveProperty('status')
      expect(atualizada).toMatchObject({
        status: 'PUBLICADA',
        publicadaEm: PUBLICADA_EM.toISOString(),
      })
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('inexistente, excluída ou de outra atlética → 404', async () => {
      const { servico, tx } = criarServico(null)
      await expect(servico.atualizar(ID, DIRETOR, { titulo: 'Novo' })).rejects.toMatchObject({
        statusCode: 404,
      })
      expect(tx.noticia.findUniqueOrThrow).not.toHaveBeenCalled()
    })

    it('troca de capa em notícia inexistente → 404 sem validar', async () => {
      const { servico, uploads } = criarServico(null)
      await expect(
        servico.atualizar(ID, DIRETOR, { imagemCapaKey: CAPA_NOVA }),
      ).rejects.toMatchObject({ statusCode: 404 })
      expect(uploads.validarKey).not.toHaveBeenCalled()
    })

    it('capa trocada por outro diretor entre a leitura e o lock: valida dentro da transação', async () => {
      const { servico, db, uploads } = criarServico()
      db.noticia.findFirst.mockResolvedValue({ imagemCapaKey: CAPA_NOVA })

      await servico.atualizar(ID, DIRETOR, { imagemCapaKey: CAPA_NOVA })

      expect(uploads.validarKey).toHaveBeenCalledWith(expect.objectContaining({ key: CAPA_NOVA }))
    })
  })

  describe('publicar', () => {
    it('primeira publicação: define publicadaEm, audita e emite o evento', async () => {
      const { servico, tx, auditoria, eventos } = criarServico()

      await servico.publicar(ID, DIRETOR)

      expect(tx.noticia.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: 'RASCUNHO' },
        data: { status: 'PUBLICADA', publicadaEm: expect.any(Date) as Date },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          acao: 'NOTICIA_PUBLICADA',
          dados: expect.objectContaining({ contexto: { primeiraPublicacao: true } }) as object,
        }),
      )
      expect(eventos.emitirAposCommit).toHaveBeenCalledTimes(1)
    })

    it('republicação: mantém a data original e não emite (critério 8)', async () => {
      const despublicada = linha({ publicadaEm: PUBLICADA_EM })
      const { servico, acoes, eventos, dadosDoUpdateMany } = criarServico(despublicada)

      await servico.publicar(ID, DIRETOR)

      expect(dadosDoUpdateMany().publicadaEm).toBe(PUBLICADA_EM)
      expect(acoes()).toEqual(['NOTICIA_PUBLICADA'])
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('já publicada: 200 sem efeitos (idempotente)', async () => {
      const publicada = linha({
        status: 'PUBLICADA',
        publicadaEm: PUBLICADA_EM,
        imagemCapaKey: null,
      })
      const { servico, tx, auditoria, eventos } = criarServico(publicada)

      await expect(servico.publicar(ID, DIRETOR)).resolves.toMatchObject({ status: 'PUBLICADA' })
      expect(tx.noticia.updateMany).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it.each([
      [{ imagemCapaKey: null }, 'CAPA_OBRIGATORIA'],
      [{ conteudo: '' }, 'CONTEUDO_OBRIGATORIO'],
    ])('rascunho %j → 422 %s, status não muda (critério 3)', async (dados, code) => {
      const { servico, tx } = criarServico(linha(dados))
      await expect(servico.publicar(ID, DIRETOR)).rejects.toMatchObject({ statusCode: 422, code })
      expect(tx.noticia.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('despublicar', () => {
    it('publicada → rascunho, audita, sem evento', async () => {
      const publicada = linha({ status: 'PUBLICADA', publicadaEm: PUBLICADA_EM })
      const { servico, tx, auditoria, eventos } = criarServico(publicada)

      await servico.despublicar(ID, DIRETOR)

      expect(tx.noticia.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: 'PUBLICADA' },
        data: { status: 'RASCUNHO' },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_DESPUBLICADA',
        entidadeId: ID,
        dados: { antes: { status: 'PUBLICADA' }, depois: { status: 'RASCUNHO' } },
      })
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('rascunho: idempotente, sem auditoria', async () => {
      const { servico, tx, auditoria } = criarServico()
      await expect(servico.despublicar(ID, DIRETOR)).resolves.toMatchObject({ status: 'RASCUNHO' })
      expect(tx.noticia.updateMany).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })
  })

  describe('excluir', () => {
    it('exclusão lógica com auditoria na mesma transação', async () => {
      const { servico, tx, auditoria, uploads } = criarServico()

      await servico.excluir(ID, DIRETOR)

      expect(tx.noticia.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { excluidoEm: expect.any(Date) as Date },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_EXCLUIDA',
        entidadeId: ID,
        dados: { antes: { titulo: 'Seletiva de futsal', status: 'RASCUNHO' }, depois: null },
      })
      expect(uploads.remover).not.toHaveBeenCalled()
    })

    it('já excluída → 404', async () => {
      const { servico, tx } = criarServico(null)
      await expect(servico.excluir(ID, DIRETOR)).rejects.toMatchObject({ statusCode: 404 })
      expect(tx.noticia.update).not.toHaveBeenCalled()
    })
  })
})
