import { MENSAGEM_RECUPERACAO_ENVIADA } from '@atletica/shared'
import { ErroLimiteExcedido } from '../../common/erros/erro-negocio'
import { CodigoVerificacaoService } from '../../infra/email/codigo-verificacao'
import { TipoCodigoVerificacao } from '../../generated/prisma/enums'
import { chaveIp } from './chaves-limite'
import { TipoTentativa } from './rate-limit.service'
import {
  LIMITE_CODIGO_IP,
  LIMITE_ENVIO_EMAIL,
  LIMITE_ENVIO_IP,
  MAXIMO_TENTATIVAS_CODIGO,
  RecuperacaoSenhaService,
} from './recuperacao-senha.service'

const EMAIL = 'ana@ex.com'
const USUARIO_ID = 'u1'
const CODIGO = '048213'
const ORIGEM = { ip: '10.0.0.1' }
const CHAVE_IP = chaveIp(ORIGEM.ip)

const codigos = new CodigoVerificacaoService({ get: () => 'pepper-de-teste' } as never)

interface CodigoLido {
  id: string
  usuarioId: string
  codigoHash: string
  usadoEm: Date | null
  expiraEm: Date
}

const codigoLido = (dados: Partial<CodigoLido> = {}): CodigoLido => ({
  id: 'c1',
  usuarioId: USUARIO_ID,
  codigoHash: codigos.hashCodigo(USUARIO_ID, CODIGO),
  usadoEm: null,
  expiraEm: new Date(Date.now() + 60_000),
  ...dados,
})

function criarServico() {
  const codigoVerificacao = {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    updateManyAndReturn: jest.fn().mockResolvedValue([{ tentativas: 1 }]),
    update: jest.fn().mockResolvedValue({}),
  }
  const usuario = {
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  }
  const tx = { codigoVerificacao, usuario }
  const semEscopo = {
    codigoVerificacao,
    usuario,
    $transaction: jest.fn((fn: (cliente: typeof tx) => unknown) => fn(tx)),
  }
  const limites = {
    verificar: jest.fn().mockResolvedValue(1),
    consumir: jest.fn().mockResolvedValue(1),
    registrar: jest.fn().mockResolvedValue(undefined),
    limparPorPrefixo: jest.fn().mockResolvedValue(undefined),
  }
  const email = { enviar: jest.fn().mockResolvedValue(undefined) }
  const sessoes = { revogarTodas: jest.fn().mockResolvedValue([]) }
  const eventos = { emitirAposCommit: jest.fn() }
  const servico = new RecuperacaoSenhaService(
    { semEscopo } as never,
    codigos,
    email as never,
    { hash: jest.fn().mockResolvedValue('hash-novo') } as never,
    limites as never,
    sessoes as never,
    { executar: (fn: (cliente: typeof tx) => unknown) => fn(tx) } as never,
    eventos as never,
    {
      id: () => 'a1',
      obter: jest.fn().mockResolvedValue({ nome: 'Atlética', sigla: 'ATT', corPrimaria: '#000' }),
    } as never,
  )
  return { servico, codigoVerificacao, usuario, limites, email, sessoes, eventos }
}

describe('RecuperacaoSenhaService.solicitar', () => {
  it('conta ativa: grava só o hash do código, com validade, e envia o e-mail', async () => {
    const { servico, usuario, codigoVerificacao, email } = criarServico()
    usuario.findFirst.mockResolvedValue({ id: USUARIO_ID })

    await expect(servico.solicitar({ email: EMAIL }, ORIGEM)).resolves.toStrictEqual({
      message: MENSAGEM_RECUPERACAO_ENVIADA,
    })

    const [{ data }] = codigoVerificacao.create.mock.calls[0] as [
      { data: { tipo: string; usuarioId: string; codigoHash: string } },
    ]
    expect(data).toMatchObject({
      usuarioId: USUARIO_ID,
      tipo: TipoCodigoVerificacao.RECUPERAR_SENHA,
    })
    const [enviado] = email.enviar.mock.calls[0] as [{ texto: string }]
    const codigo = /\b\d{6}\b/.exec(enviado.texto)?.[0] ?? ''
    expect(codigos.codigoConfere(data.codigoHash, USUARIO_ID, codigo)).toBe(true)
  })

  it('conta inexistente: mesma resposta, sem código nem e-mail', async () => {
    const { servico, codigoVerificacao, email, limites } = criarServico()

    await expect(servico.solicitar({ email: EMAIL }, ORIGEM)).resolves.toStrictEqual({
      message: MENSAGEM_RECUPERACAO_ENVIADA,
    })
    expect(codigoVerificacao.create).not.toHaveBeenCalled()
    expect(email.enviar).not.toHaveBeenCalled()
    expect(limites.consumir).toHaveBeenCalledWith(
      TipoTentativa.RECUPERACAO_ENVIO,
      EMAIL,
      LIMITE_ENVIO_EMAIL,
    )
  })

  it('IP bloqueado: não conta envio para o e-mail', async () => {
    const { servico, limites } = criarServico()
    limites.verificar.mockRejectedValue(new ErroLimiteExcedido(60))

    await expect(servico.solicitar({ email: EMAIL }, ORIGEM)).rejects.toThrow(ErroLimiteExcedido)
    expect(limites.consumir).not.toHaveBeenCalled()
  })

  it('e-mail no limite: 429 com a mensagem de envios e sem contar para o IP', async () => {
    const { servico, limites } = criarServico()
    limites.consumir.mockRejectedValueOnce(new ErroLimiteExcedido(2_520))

    await expect(servico.solicitar({ email: EMAIL }, ORIGEM)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Limite de 3 envios por hora atingido. Tente novamente em 42 min.',
    })
    expect(limites.consumir).toHaveBeenCalledTimes(1)
    expect(limites.consumir).not.toHaveBeenCalledWith(
      TipoTentativa.RECUPERACAO_ENVIO,
      CHAVE_IP,
      LIMITE_ENVIO_IP,
    )
  })
})

describe('RecuperacaoSenhaService.verificarCodigo', () => {
  const verificar = (servico: RecuperacaoSenhaService, codigo = CODIGO) =>
    servico.verificarCodigo({ email: EMAIL, codigo }, ORIGEM)

  it('código certo → válido, sem contar tentativa', async () => {
    const { servico, codigoVerificacao, limites } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])

    await expect(verificar(servico)).resolves.toStrictEqual({ valido: true })
    expect(codigoVerificacao.updateManyAndReturn).not.toHaveBeenCalled()
    expect(limites.registrar).not.toHaveBeenCalled()
    expect(limites.verificar).toHaveBeenCalledWith(
      TipoTentativa.CODIGO_TENTATIVA,
      CHAVE_IP,
      LIMITE_CODIGO_IP,
    )
  })

  it('só considera o código mais recente do tipo RECUPERAR_SENHA', async () => {
    const { servico, codigoVerificacao } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])

    await verificar(servico)

    expect(codigoVerificacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tipo: TipoCodigoVerificacao.RECUPERAR_SENHA,
          usuario: { email: EMAIL, excluidoEm: null },
        },
        orderBy: { criadoEm: 'desc' },
        take: 1,
      }),
    )
  })

  it.each([
    ['errado', codigoLido(), '999999'],
    [
      'mais antigo que o último',
      codigoLido({ codigoHash: codigos.hashCodigo(USUARIO_ID, '111111') }),
      CODIGO,
    ],
  ])(
    'código %s → CODIGO_INVALIDO e conta tentativa no código e no IP',
    async (_caso, ativo, codigo) => {
      const { servico, codigoVerificacao, limites } = criarServico()
      codigoVerificacao.findMany.mockResolvedValue([ativo])

      await expect(verificar(servico, codigo)).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
      expect(codigoVerificacao.updateManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', usadoEm: null },
          data: { tentativas: { increment: 1 } },
        }),
      )
      expect(limites.registrar).toHaveBeenCalledWith(TipoTentativa.CODIGO_TENTATIVA, CHAVE_IP)
    },
  )

  it.each([
    ['expirado', [codigoLido({ expiraEm: new Date(Date.now() - 1) })]],
    ['já usado', [codigoLido({ usadoEm: new Date() })]],
    ['de outro tipo ou inexistente', []],
  ])('código %s → CODIGO_INVALIDO, conta só no IP', async (_caso, encontrados) => {
    const { servico, codigoVerificacao, limites } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue(encontrados)

    await expect(verificar(servico)).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
    expect(codigoVerificacao.updateManyAndReturn).not.toHaveBeenCalled()
    expect(limites.registrar).toHaveBeenCalledWith(TipoTentativa.CODIGO_TENTATIVA, CHAVE_IP)
  })

  it(`na ${MAXIMO_TENTATIVAS_CODIGO}ª tentativa errada o código expira`, async () => {
    const { servico, codigoVerificacao } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])
    codigoVerificacao.updateManyAndReturn.mockResolvedValue([
      { tentativas: MAXIMO_TENTATIVAS_CODIGO },
    ])

    await expect(verificar(servico, '999999')).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
    const [expiracao] = codigoVerificacao.update.mock.calls[0] as [
      { where: { id: string }; data: { expiraEm: Date } },
    ]
    expect(expiracao.where).toStrictEqual({ id: 'c1' })
    expect(expiracao.data.expiraEm.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('antes da última tentativa o código continua válido', async () => {
    const { servico, codigoVerificacao } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])
    codigoVerificacao.updateManyAndReturn.mockResolvedValue([
      { tentativas: MAXIMO_TENTATIVAS_CODIGO - 1 },
    ])

    await expect(verificar(servico, '999999')).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
    expect(codigoVerificacao.update).not.toHaveBeenCalled()
  })

  it('IP bloqueado → 429 sem consultar o código', async () => {
    const { servico, codigoVerificacao, limites } = criarServico()
    limites.verificar.mockRejectedValue(new ErroLimiteExcedido(60))

    await expect(verificar(servico)).rejects.toThrow(ErroLimiteExcedido)
    expect(codigoVerificacao.findMany).not.toHaveBeenCalled()
  })
})

describe('RecuperacaoSenhaService.redefinir', () => {
  const redefinir = (servico: RecuperacaoSenhaService) =>
    servico.redefinir({ email: EMAIL, codigo: CODIGO, novaSenha: 'novaSenha9' }, ORIGEM)

  it('troca a senha, revoga as sessões e emite o evento após o commit', async () => {
    const { servico, codigoVerificacao, usuario, sessoes, eventos, limites } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])
    sessoes.revogarTodas.mockResolvedValue(['s1', 's2'])

    await redefinir(servico)

    expect(usuario.update).toHaveBeenCalledWith({
      where: { id: USUARIO_ID },
      data: { senhaHash: 'hash-novo' },
    })
    expect(sessoes.revogarTodas).toHaveBeenCalledWith(
      expect.anything(),
      USUARIO_ID,
      'RECUPERACAO_SENHA',
    )
    expect(limites.limparPorPrefixo).toHaveBeenCalledWith(
      TipoTentativa.LOGIN_FALHA,
      `${EMAIL}|`,
      expect.anything(),
    )
    expect(eventos.emitirAposCommit).toHaveBeenCalledWith('usuario.sessaoEncerrada', {
      usuarioId: USUARIO_ID,
      sessaoIds: ['s1', 's2'],
      motivo: 'RECUPERACAO_SENHA',
      autorId: null,
    })
  })

  it('sem sessões abertas não emite o evento', async () => {
    const { servico, codigoVerificacao, eventos } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])

    await redefinir(servico)

    expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
  })

  it('código consumido por outra redefinição → CODIGO_INVALIDO sem trocar a senha', async () => {
    const { servico, codigoVerificacao, usuario } = criarServico()
    codigoVerificacao.findMany.mockResolvedValue([codigoLido()])
    codigoVerificacao.updateMany.mockResolvedValue({ count: 0 })

    await expect(redefinir(servico)).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' })
    expect(usuario.update).not.toHaveBeenCalled()
  })
})
