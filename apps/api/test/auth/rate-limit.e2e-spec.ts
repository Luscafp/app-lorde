import { ErroLimiteExcedido } from '../../src/common/erros/erro-negocio'
import {
  RateLimitService,
  TipoTentativa,
  type LimiteTentativas,
} from '../../src/modules/auth/rate-limit.service'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const MINUTO = 60_000
const LOGIN: LimiteTentativas = { maximo: 5, janelaMs: 15 * MINUTO }
const CHAVE = 'ana@ex.com|10.0.0.1'
const t0 = new Date('2026-10-04T12:00:00.000Z')
const em = (minutos: number) => new Date(t0.getTime() + minutos * MINUTO)

describe('RateLimitService (#57)', () => {
  let contexto: AppDeTeste
  let servico: RateLimitService

  beforeAll(async () => {
    contexto = await criarApp()
    servico = contexto.app.get(RateLimitService)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function falhar(...minutos: number[]): Promise<void> {
    for (const minuto of minutos)
      await servico.registrar(TipoTentativa.LOGIN_FALHA, CHAVE, em(minuto))
  }

  async function retryAfter(agora: Date, tipo: TipoTentativa = TipoTentativa.LOGIN_FALHA) {
    try {
      await servico.verificar(tipo, CHAVE, LOGIN, agora)
      return undefined
    } catch (erro) {
      if (erro instanceof ErroLimiteExcedido) return erro.retryAfter
      throw erro
    }
  }

  it('4 falhas → liberado, com 1 tentativa restante', async () => {
    await falhar(0, 1, 2, 3)
    await expect(servico.verificar(TipoTentativa.LOGIN_FALHA, CHAVE, LOGIN, em(3))).resolves.toBe(1)
  })

  it('5ª falha → 429 até t5 + 15 min', async () => {
    await falhar(0, 1, 2, 3, 4)
    expect(await retryAfter(em(4))).toBe(900)
    expect(await retryAfter(em(18.5))).toBe(30)
    expect(await retryAfter(em(19))).toBeUndefined()
  })

  it('falhas fora da janela não contam', async () => {
    await falhar(0, 1, 2, 20, 21)
    await expect(servico.verificar(TipoTentativa.LOGIN_FALHA, CHAVE, LOGIN, em(21))).resolves.toBe(
      3,
    )
  })

  it('limpar zera a contagem da chave', async () => {
    await falhar(0, 1, 2, 3, 4)
    await servico.limpar(TipoTentativa.LOGIN_FALHA, CHAVE)
    expect(await retryAfter(em(4))).toBeUndefined()
    await expect(prismaTeste.tentativaAcesso.count()).resolves.toBe(0)
  })

  it('tipos diferentes com a mesma chave não se misturam', async () => {
    await falhar(0, 1, 2, 3, 4)
    await servico.registrar(TipoTentativa.CADASTRO, CHAVE, em(4))

    expect(await retryAfter(em(4))).toBe(900)
    expect(await retryAfter(em(4), TipoTentativa.CADASTRO)).toBeUndefined()

    await servico.limpar(TipoTentativa.CADASTRO, CHAVE)
    expect(await retryAfter(em(4))).toBe(900)
  })

  it('chaves diferentes não se misturam', async () => {
    await falhar(0, 1, 2, 3, 4)
    await expect(
      servico.verificar(TipoTentativa.LOGIN_FALHA, 'ana@ex.com|10.0.0.2', LOGIN, em(4)),
    ).resolves.toBe(5)
  })
})
