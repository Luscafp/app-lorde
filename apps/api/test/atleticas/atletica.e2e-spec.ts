import { atleticaPublicaSchema } from '@atletica/shared'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { ConfiguracaoModule } from '../../src/config/config.module'
import { ContextoModule } from '../../src/infra/contexto/contexto.module'
import { PrismaModule } from '../../src/infra/prisma/prisma.module'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { AtleticasModule } from '../../src/modules/atleticas/atleticas.module'
import { ErroAtleticaPadrao } from '../../src/modules/atleticas/erros'
import { criarAtletica, type DadosAtletica } from '../fabricas/atletica'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/atletica'

const COMPLETA = {
  nome: 'Atlética Padrão',
  sigla: 'PADRAO',
  curso: 'Ciência da Computação',
  logoUrl: 'https://img.exemplo.com/logo.png',
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: 'diretoria@exemplo.com',
  contatoInstagram: '@padrao',
  contatoWhatsapp: '+5598999999999',
}

describe('GET /atletica (#50)', () => {
  let contexto: AppDeTeste
  let padraoId: string

  /** O `beforeEach` esvazia o banco: recria a atlética padrão com o id resolvido na subida. */
  const criarPadrao = (dados: DadosAtletica = {}) => criarAtletica({ ...dados, id: padraoId })

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('sem token → 200 só com os campos documentados', async () => {
    await criarPadrao(COMPLETA)

    const resposta = await request(contexto.http).get(ROTA)

    expect(resposta.status).toBe(200)
    expect(resposta.body).toStrictEqual({ id: padraoId, ...COMPLETA })
    expect(Object.keys(resposta.body as object).sort()).toEqual(
      Object.keys(atleticaPublicaSchema.shape).sort(),
    )
  })

  it('campos vazios no banco saem como null', async () => {
    await criarPadrao({ nome: 'Só o básico', sigla: 'SB' })

    const resposta = await request(contexto.http).get(ROTA)

    expect(resposta.status).toBe(200)
    expect(resposta.body).toStrictEqual({
      id: padraoId,
      nome: 'Só o básico',
      sigla: 'SB',
      curso: null,
      logoUrl: null,
      corPrimaria: '#1A2B3C',
      corSecundaria: '#FFFFFF',
      contatoEmail: null,
      contatoInstagram: null,
      contatoWhatsapp: null,
    })
  })

  it('Cache-Control público e ETag; If-None-Match com o ETag atual → 304 sem corpo', async () => {
    await criarPadrao(COMPLETA)

    const primeira = await request(contexto.http).get(ROTA)
    const etag = primeira.headers.etag

    expect(primeira.headers['cache-control']).toBe('public, max-age=300')
    expect(etag).toEqual(expect.any(String))

    const segunda = await request(contexto.http)
      .get(ROTA)
      .set('If-None-Match', etag ?? '')
    expect(segunda.status).toBe(304)
    expect(segunda.text).toBeFalsy()
  })

  it('mudança no banco gera novo ETag e vale sem reiniciar a API', async () => {
    await criarPadrao(COMPLETA)
    const antes = await request(contexto.http).get(ROTA)

    await prismaTeste.atletica.update({ where: { id: padraoId }, data: { corPrimaria: '#000000' } })
    const depois = await request(contexto.http)
      .get(ROTA)
      .set('If-None-Match', antes.headers.etag ?? '')

    expect(depois.status).toBe(200)
    expect(depois.headers.etag).not.toBe(antes.headers.etag)
    expect((depois.body as { corPrimaria: string }).corPrimaria).toBe('#000000')
  })

  it('nunca retorna uma atlética adversária (usaAplicativo = false)', async () => {
    await criarAtletica({ nome: 'AAA Adversária', usaAplicativo: false })
    await criarPadrao({ nome: 'ZZZ Padrão' })
    await criarAtletica({ nome: 'BBB Adversária', usaAplicativo: false })

    const resposta = await request(contexto.http).get(ROTA)

    expect(resposta.status).toBe(200)
    expect(resposta.body).toMatchObject({ id: padraoId, nome: 'ZZZ Padrão' })
  })
})

describe('AtleticaPadraoService na inicialização (#50)', () => {
  async function iniciar() {
    const modulo = await Test.createTestingModule({
      imports: [ConfiguracaoModule, ContextoModule, PrismaModule, AtleticasModule],
    }).compile()
    try {
      await modulo.init()
      return modulo.get(AtleticaPadraoService).id()
    } finally {
      await modulo.close()
    }
  }

  it('sem nenhuma atlética usaAplicativo = true → não sobe e explica o motivo', async () => {
    await criarAtletica({ usaAplicativo: false })

    const falha = iniciar()

    await expect(falha).rejects.toBeInstanceOf(ErroAtleticaPadrao)
    await expect(falha).rejects.toThrow('Nenhuma atlética com usaAplicativo = true')
  })

  it('com duas atléticas usaAplicativo = true → não sobe e lista as duas', async () => {
    await criarAtletica({ nome: 'Atlética Um' })
    await criarAtletica({ nome: 'Atlética Dois' })

    await expect(iniciar()).rejects.toThrow(
      'Esperada uma única atlética com usaAplicativo = true; encontradas 2: ' +
        'Atlética Dois, Atlética Um.',
    )
  })

  it('com uma atlética usaAplicativo = true e adversárias → guarda o id dela', async () => {
    await criarAtletica({ usaAplicativo: false })
    const padrao = await criarAtletica()

    await expect(iniciar()).resolves.toBe(padrao.id)
  })
})
