import { VALIDADE_CODIGO_VERIFICACAO_MS } from '@atletica/shared'
import { HORA_MS, MINUTO_MS } from '../../../common/tempo'
import { CodigoVerificacaoService } from '../../../infra/email/codigo-verificacao'
import { RateLimitService } from '../rate-limit.service'
import { VerificacaoEmailOuvinte } from './verificacao-email.ouvinte'
import {
  MAXIMO_TENTATIVAS_VERIFICACAO,
  RETENCAO_CODIGOS_EXPIRADOS_MS,
  VerificacaoEmailService,
} from './verificacao-email.service'

const USUARIO = { id: 'u1', atleticaId: 'a1' }
const T0 = new Date('2026-10-01T12:00:00.000Z')
const em = (ms: number) => new Date(T0.getTime() + ms)

type Registro = Record<string, unknown>
type Condicao = { gt?: Date; lt?: Date; lte?: Date }

function atende(registro: Registro, where: Registro): boolean {
  return Object.entries(where).every(([campo, esperado]) => {
    const valor = registro[campo]
    if (esperado === null || typeof esperado !== 'object') return valor === esperado
    const { gt, lt, lte } = esperado as Condicao
    const tempo = (valor as Date).getTime()
    return (
      (gt === undefined || tempo > gt.getTime()) &&
      (lt === undefined || tempo < lt.getTime()) &&
      (lte === undefined || tempo <= lte.getTime())
    )
  })
}

function aplicar(registro: Registro, data: Registro): void {
  for (const [campo, valor] of Object.entries(data)) {
    const incremento = (valor as { increment?: number } | null)?.increment
    registro[campo] = incremento === undefined ? valor : (registro[campo] as number) + incremento
  }
}

/** Tabela em memória com o subconjunto do Prisma usado aqui. */
function tabela(padrao: () => Registro = () => ({})) {
  const linhas: Registro[] = []
  let sequencia = 0
  const filtrar = (where: Registro = {}) => linhas.filter((linha) => atende(linha, where))
  return {
    linhas,
    create: jest.fn(({ data }: { data: Registro }) => {
      const linha = { id: `id${++sequencia}`, ...padrao(), ...data }
      linhas.push(linha)
      return Promise.resolve(linha)
    }),
    findMany: jest.fn(({ where, take }: { where?: Registro; take?: number }) =>
      Promise.resolve(
        filtrar(where)
          .sort((a, b) => (b.criadoEm as Date).getTime() - (a.criadoEm as Date).getTime())
          .slice(0, take),
      ),
    ),
    updateMany: jest.fn(({ where, data }: { where: Registro; data: Registro }) => {
      const alvos = filtrar(where)
      alvos.forEach((linha) => aplicar(linha, data))
      return Promise.resolve({ count: alvos.length })
    }),
    updateManyAndReturn: jest.fn(({ where, data }: { where: Registro; data: Registro }) => {
      const alvos = filtrar(where)
      alvos.forEach((linha) => aplicar(linha, data))
      return Promise.resolve(alvos)
    }),
    update: jest.fn(({ where, data }: { where: Registro; data: Registro }) => {
      const [linha] = filtrar(where)
      if (linha) aplicar(linha, data)
      return Promise.resolve(linha)
    }),
    deleteMany: jest.fn(({ where }: { where: Registro }) => {
      const alvos = filtrar(where)
      alvos.forEach((linha) => linhas.splice(linhas.indexOf(linha), 1))
      return Promise.resolve({ count: alvos.length })
    }),
  }
}

function criarServico({ emailVerificado = false } = {}) {
  const usuario = { id: USUARIO.id, email: 'ana@gmail.com', emailVerificado }
  const usuarios = {
    findUniqueOrThrow: jest.fn(() => Promise.resolve({ ...usuario })),
    update: jest.fn(({ data }: { data: Registro }) => {
      Object.assign(usuario, data)
      return Promise.resolve(usuario)
    }),
  }
  const tentativaAcesso = tabela()
  const codigoVerificacao = tabela(() => ({ tentativas: 0, usadoEm: null }))
  const cliente = {
    usuario: usuarios,
    tentativaAcesso,
    codigoVerificacao,
    $executeRaw: jest.fn().mockResolvedValue(0),
  }
  const semEscopo = {
    ...cliente,
    $transaction: jest.fn((operacao: unknown) =>
      typeof operacao === 'function'
        ? (operacao as (tx: typeof cliente) => unknown)(cliente)
        : Promise.all(operacao as Promise<unknown>[]),
    ),
  }
  const atletica = {
    findUniqueOrThrow: jest
      .fn()
      .mockResolvedValue({ nome: 'Atlética Teste', sigla: 'ATT', corPrimaria: null }),
  }
  const prisma = { semEscopo, db: { atletica } }
  const codigos = new CodigoVerificacaoService({ get: () => 'pepper-de-teste' } as never)
  const email = { enviar: jest.fn().mockResolvedValue(undefined) }
  const limites = new RateLimitService(prisma as never)
  const servico = new VerificacaoEmailService(prisma as never, codigos, email as never, limites)

  const ultimoCodigo = (): string => {
    const [mensagem] = email.enviar.mock.calls.at(-1) as [{ texto: string }]
    return /\b\d{6}\b/.exec(mensagem.texto)?.[0] ?? ''
  }

  return { servico, usuario, codigoVerificacao, codigos, email, atletica, limites, ultimoCodigo }
}

const outroCodigo = (codigo: string) => (codigo === '111111' ? '222222' : '111111')

describe('VerificacaoEmailService.enviarCodigo', () => {
  it('código de 6 dígitos com zeros à esquerda; só o hash vai ao banco', async () => {
    const { servico, codigos, codigoVerificacao, email } = criarServico()
    jest.spyOn(codigos, 'gerarCodigo').mockReturnValue('000123')

    const resposta = await servico.enviarCodigo(USUARIO, T0)

    const [registro] = codigoVerificacao.linhas
    expect(registro).toMatchObject({ usuarioId: USUARIO.id, tipo: 'VERIFICAR_EMAIL' })
    expect(registro?.codigoHash).not.toContain('000123')
    expect(codigos.codigoConfere(registro?.codigoHash as string, USUARIO.id, '000123')).toBe(true)
    expect(email.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'ana@gmail.com', assunto: 'ATT: confirme seu e-mail' }),
    )
    expect(resposta).toStrictEqual({
      enviadoPara: 'a***@gmail.com',
      expiraEm: em(VALIDADE_CODIGO_VERIFICACAO_MS).toISOString(),
      proximoEnvioEm: em(MINUTO_MS).toISOString(),
    })
  })

  it('usa a atlética informada (sem atlética fixa)', async () => {
    const { servico, atletica } = criarServico()

    await servico.enviarCodigo(USUARIO, T0)

    expect(atletica.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USUARIO.atleticaId } }),
    )
  })

  it('já verificado → 409 EMAIL_JA_VERIFICADO sem e-mail', async () => {
    const { servico, email } = criarServico({ emailVerificado: true })

    await expect(servico.enviarCodigo(USUARIO, T0)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_JA_VERIFICADO',
    })
    expect(email.enviar).not.toHaveBeenCalled()
  })

  it('intervalo de 60 s: novo envio após 30 s → 429 com proximoEnvioEm', async () => {
    const { servico, email } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)

    await expect(servico.enviarCodigo(USUARIO, em(30_000))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      segundosParaNovaTentativa: 30,
      details: [{ field: 'proximoEnvioEm', message: em(MINUTO_MS).toISOString() }],
    })
    expect(email.enviar).toHaveBeenCalledTimes(1)
  })

  it('3 envios por hora: o 4º → 429 até 1 h depois do 1º', async () => {
    const { servico, email } = criarServico()
    for (const minuto of [0, 2, 4]) await servico.enviarCodigo(USUARIO, em(minuto * MINUTO_MS))

    await expect(servico.enviarCodigo(USUARIO, em(6 * MINUTO_MS))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: [{ field: 'proximoEnvioEm', message: em(HORA_MS).toISOString() }],
    })
    await expect(servico.enviarCodigo(USUARIO, em(HORA_MS))).resolves.toBeDefined()
    expect(email.enviar).toHaveBeenCalledTimes(4)
  })

  it('no 3º envio, proximoEnvioEm aponta o fim da janela de 1 h', async () => {
    const { servico } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)
    await servico.enviarCodigo(USUARIO, em(2 * MINUTO_MS))

    const terceiro = await servico.enviarCodigo(USUARIO, em(4 * MINUTO_MS))

    expect(terceiro.proximoEnvioEm).toBe(em(HORA_MS).toISOString())
  })

  it('3 por hora revalidado sob lock: envio simultâneo que passou da checagem → 429', async () => {
    const { servico, email, limites } = criarServico()
    for (const minuto of [0, 2, 4]) await servico.enviarCodigo(USUARIO, em(minuto * MINUTO_MS))
    jest.spyOn(limites, 'liberadoEm').mockResolvedValueOnce(null)

    await expect(servico.enviarCodigo(USUARIO, em(6 * MINUTO_MS))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: [{ field: 'proximoEnvioEm', message: em(HORA_MS).toISOString() }],
    })
    expect(email.enviar).toHaveBeenCalledTimes(3)
  })

  it('apaga os códigos do usuário expirados há mais de 7 dias', async () => {
    const { servico, codigoVerificacao } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)
    const expirado = em(VALIDADE_CODIGO_VERIFICACAO_MS)

    await servico.enviarCodigo(
      USUARIO,
      new Date(expirado.getTime() + RETENCAO_CODIGOS_EXPIRADOS_MS),
    )
    expect(codigoVerificacao.linhas).toHaveLength(2)

    await servico.enviarCodigo(
      USUARIO,
      new Date(expirado.getTime() + RETENCAO_CODIGOS_EXPIRADOS_MS + HORA_MS),
    )
    expect(codigoVerificacao.linhas).toHaveLength(2)
    expect(codigoVerificacao.linhas.map(({ criadoEm }) => criadoEm)).not.toContainEqual(T0)
  })

  it('falha do provedor de e-mail não propaga e o código fica gravado', async () => {
    const { servico, email, codigoVerificacao } = criarServico()
    email.enviar.mockRejectedValue(new Error('Resend fora do ar'))

    await expect(servico.enviarCodigo(USUARIO, T0)).resolves.toBeDefined()
    expect(codigoVerificacao.linhas).toHaveLength(1)
  })
})

describe('VerificacaoEmailService.confirmar', () => {
  it('código correto → emailVerificado = true e código usado', async () => {
    const { servico, usuario, codigoVerificacao, ultimoCodigo } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)

    await expect(
      servico.confirmar(USUARIO.id, { codigo: ultimoCodigo() }, em(MINUTO_MS)),
    ).resolves.toStrictEqual({ emailVerificado: true })
    expect(usuario.emailVerificado).toBe(true)
    expect(codigoVerificacao.linhas[0]?.usadoEm).toEqual(em(MINUTO_MS))
  })

  it('código errado → 400 CODIGO_INVALIDO e conta a tentativa', async () => {
    const { servico, codigoVerificacao, ultimoCodigo } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)

    await expect(
      servico.confirmar(USUARIO.id, { codigo: outroCodigo(ultimoCodigo()) }, T0),
    ).rejects.toMatchObject({ statusCode: 400, code: 'CODIGO_INVALIDO' })
    expect(codigoVerificacao.linhas[0]?.tentativas).toBe(1)
  })

  it('código com mais de 24 h → 400 CODIGO_EXPIRADO', async () => {
    const { servico, ultimoCodigo } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)

    await expect(
      servico.confirmar(USUARIO.id, { codigo: ultimoCodigo() }, em(VALIDADE_CODIGO_VERIFICACAO_MS)),
    ).rejects.toMatchObject({ code: 'CODIGO_EXPIRADO' })
  })

  it(`${MAXIMO_TENTATIVAS_VERIFICACAO} tentativas erradas invalidam o código`, async () => {
    const { servico, ultimoCodigo } = criarServico()
    await servico.enviarCodigo(USUARIO, T0)
    const codigo = ultimoCodigo()

    for (let i = 0; i < MAXIMO_TENTATIVAS_VERIFICACAO; i++) {
      await expect(
        servico.confirmar(USUARIO.id, { codigo: outroCodigo(codigo) }, T0),
      ).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
    }
    await expect(servico.confirmar(USUARIO.id, { codigo }, T0)).rejects.toMatchObject({
      code: 'CODIGO_EXPIRADO',
    })
  })

  it('reenviar invalida o código anterior → CODIGO_INVALIDO', async () => {
    const { servico, ultimoCodigo, codigos } = criarServico()
    jest.spyOn(codigos, 'gerarCodigo').mockReturnValueOnce('111111').mockReturnValueOnce('222222')
    await servico.enviarCodigo(USUARIO, T0)
    const anterior = ultimoCodigo()
    await servico.enviarCodigo(USUARIO, em(MINUTO_MS))

    await expect(
      servico.confirmar(USUARIO.id, { codigo: anterior }, em(2 * MINUTO_MS)),
    ).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
  })

  it('sem código (nunca enviado ou já apagado) → CODIGO_EXPIRADO', async () => {
    const { servico } = criarServico()

    await expect(servico.confirmar(USUARIO.id, { codigo: '123456' }, T0)).rejects.toMatchObject({
      code: 'CODIGO_EXPIRADO',
    })
  })

  it('idempotente: já verificado → 200 sem consultar códigos', async () => {
    const { servico, codigoVerificacao } = criarServico({ emailVerificado: true })

    await expect(servico.confirmar(USUARIO.id, { codigo: '000000' }, T0)).resolves.toStrictEqual({
      emailVerificado: true,
    })
    expect(codigoVerificacao.findMany).not.toHaveBeenCalled()
  })
})

describe('VerificacaoEmailOuvinte', () => {
  const payload = { usuarioId: USUARIO.id, atleticaId: USUARIO.atleticaId, autorId: USUARIO.id }

  function criarOuvinte(enviarCodigo: jest.Mock) {
    const contexto = {
      executarComAtletica: jest.fn((_id: string, fn: () => unknown) => Promise.resolve(fn())),
    }
    const ouvinte = new VerificacaoEmailOuvinte({ enviarCodigo } as never, contexto as never)
    return { ouvinte, contexto }
  }

  it('envia um código no contexto da atlética do payload', async () => {
    const enviarCodigo = jest.fn().mockResolvedValue({})
    const { ouvinte, contexto } = criarOuvinte(enviarCodigo)

    await ouvinte.aoCadastrar(payload)

    expect(contexto.executarComAtletica).toHaveBeenCalledWith(
      USUARIO.atleticaId,
      expect.any(Function),
    )
    expect(enviarCodigo).toHaveBeenCalledTimes(1)
    expect(enviarCodigo).toHaveBeenCalledWith({ id: USUARIO.id, atleticaId: USUARIO.atleticaId })
  })

  it('erro no envio não propaga', async () => {
    const { ouvinte } = criarOuvinte(jest.fn().mockRejectedValue(new Error('banco fora')))

    await expect(ouvinte.aoCadastrar(payload)).resolves.toBeUndefined()
  })
})
