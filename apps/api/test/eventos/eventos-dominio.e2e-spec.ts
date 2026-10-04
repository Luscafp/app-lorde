import { Controller, Injectable, Logger, Post } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { ClsService } from 'nestjs-cls'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../../src/app.module'
import { configurarApp } from '../../src/configurar-app'
import type { StoreContexto } from '../../src/infra/contexto/contexto-atletica.service'
import { aposCommit, TransacaoService } from '../../src/infra/eventos/apos-commit'
import type { PayloadBase } from '../../src/infra/eventos/eventos-dominio'
import { EventosDominioService } from '../../src/infra/eventos/eventos-dominio.service'
import { Publico } from '../../src/modules/auth/decorators/publico.decorator'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { prepararAtleticaPadrao } from '../fabricas/atletica'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { prismaTeste } from '../setup/prisma-teste'

declare module '../../src/infra/eventos/eventos-dominio' {
  interface EventosDominio {
    'teste.ocorrido': PayloadBase & { usuarioId: string }
    'teste.falhou': PayloadBase
  }
}

@Injectable()
class OuvinteTeste {
  /** Papel lido do banco no momento em que o ouvinte roda. */
  readonly vistos: (string | undefined)[] = []
  private concluir = () => {}
  /** Resolvida quando o ouvinte termina de processar o próximo evento. */
  processado = Promise.resolve()

  reiniciar(): void {
    this.vistos.length = 0
    this.processado = new Promise((resolver) => (this.concluir = resolver))
  }

  @OnEvent('teste.ocorrido', { async: true })
  async aoOcorrer({ usuarioId }: { usuarioId: string }): Promise<void> {
    const vinculo = await prismaTeste.vinculoAtletica.findFirst({ where: { usuarioId } })
    this.vistos.push(vinculo?.papel)
    this.concluir()
  }

  @OnEvent('teste.falhou', { async: true })
  aoFalhar(): void {
    throw new Error('ouvinte quebrou')
  }
}

@Controller('teste-eventos')
@Publico()
class EventosController {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly eventos: EventosDominioService,
  ) {}

  @Post('falha-no-ouvinte')
  async falhaNoOuvinte(): Promise<{ ok: true }> {
    await this.transacao.executar(async () => {
      this.eventos.emitirAposCommit('teste.falhou', { autorId: null })
      await Promise.resolve()
    })
    return { ok: true }
  }
}

describe('Eventos de domínio e aposCommit (integração)', () => {
  let app: NestExpressApplication
  let http: App
  let cls: ClsService<StoreContexto>
  let transacao: TransacaoService
  let eventos: EventosDominioService
  let ouvinte: OuvinteTeste
  let espiao: EspiaoEventos
  let atleta: UsuarioCriado

  beforeAll(async () => {
    await prepararAtleticaPadrao()
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [EventosController],
      providers: [OuvinteTeste],
    }).compile()
    app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false })
    configurarApp(app)
    await app.init()
    http = app.getHttpServer()
    cls = app.get(ClsService)
    transacao = app.get(TransacaoService)
    eventos = app.get(EventosDominioService)
    ouvinte = app.get(OuvinteTeste)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    espiao = espiarEventos(app)
    ouvinte.reiniciar()
    atleta = await criarUsuario()
  })

  function promover(fn?: () => void) {
    return cls.run(() => {
      cls.set('atleticaId', atleta.atleticaId)
      return transacao.executar(async (tx) => {
        await tx.vinculoAtletica.update({
          where: { id: atleta.vinculo.id },
          data: { papel: 'DIRETOR' },
        })
        eventos.emitirAposCommit('teste.ocorrido', {
          atleticaId: atleta.atleticaId,
          usuarioId: atleta.id,
          autorId: null,
        })
        fn?.()
      })
    })
  }

  it('ouvinte recebe o evento depois do commit, com a alteração visível (critério 13)', async () => {
    await promover()
    await ouvinte.processado

    expect(espiao.emitidos()).toEqual([
      {
        nome: 'teste.ocorrido',
        payload: { atleticaId: atleta.atleticaId, usuarioId: atleta.id, autorId: null },
      },
    ])
    expect(ouvinte.vistos).toEqual(['DIRETOR'])
  })

  it('rollback: nada é emitido e nenhum callback roda (critério 14)', async () => {
    const callback = jest.fn()
    await expect(
      promover(() => {
        aposCommit(callback)
        throw new Error('desfaz')
      }),
    ).rejects.toThrow('desfaz')
    await aguardarOuvintes()

    expect(espiao.emitidos()).toEqual([])
    expect(callback).not.toHaveBeenCalled()
    expect(ouvinte.vistos).toEqual([])
    expect(
      await prismaTeste.vinculoAtletica.findUniqueOrThrow({ where: { id: atleta.vinculo.id } }),
    ).toMatchObject({ papel: 'ATLETA' })
  })

  it('erro no ouvinte não afeta a resposta e é logado (critério 15)', async () => {
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const resposta = await request(http).post('/api/v1/teste-eventos/falha-no-ouvinte')
    await aguardarOuvintes()

    expect(resposta.status).toBe(201)
    expect(resposta.body).toEqual({ ok: true })
    expect(espiao.nomes()).toEqual(['teste.falhou'])
    expect(erro).toHaveBeenCalledWith('ouvinte quebrou', expect.any(String))
    erro.mockRestore()
  })

  it('callbacks do service interno não rodam se a transação externa for desfeita (critério 17)', async () => {
    const interno = jest.fn()
    await expect(
      cls.run(() =>
        transacao.executar(async () => {
          await transacao.executar(async () => {
            aposCommit(interno)
            eventos.emitirAposCommit('teste.falhou', { autorId: null })
            await Promise.resolve()
          })
          throw new Error('externa desfeita')
        }),
      ),
    ).rejects.toThrow('externa desfeita')
    await aguardarOuvintes()

    expect(interno).not.toHaveBeenCalled()
    expect(espiao.emitidos()).toEqual([])
  })

  it('espiarEventos começa vazio a cada teste', () => {
    expect(espiao.emitidos()).toEqual([])
  })
})
