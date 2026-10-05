import { FUSO_PADRAO } from '@atletica/shared'
import { SchedulerRegistry } from '@nestjs/schedule'
import {
  JOB_LIMPEZA_DIARIA,
  LimpezaDiariaJob,
  RETENCAO_CODIGOS_MS,
  RETENCAO_SESSOES_ENCERRADAS_MS,
  RETENCAO_TENTATIVAS_MS,
} from '../../src/infra/agendador/limpeza-diaria.job'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { criarAtletica } from '../fabricas/atletica'
import { criarSessao } from '../fabricas/auth'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const AGORA = new Date('2026-10-04T06:00:00.000Z')
const antes = (ms: number) => new Date(AGORA.getTime() - ms)
const depois = (ms: number) => new Date(AGORA.getTime() + ms)

describe('Limpeza diária (#58, #62)', () => {
  let contexto: AppDeTeste
  let padraoId: string

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('registra o job diário no ScheduleModule, às 03:00 de FUSO_PADRAO', () => {
    const job = contexto.app.get(SchedulerRegistry).getCronJob(JOB_LIMPEZA_DIARIA)

    expect(job.cronTime.source).toBe('0 3 * * *')
    expect(job.cronTime.timeZone).toBe(FUSO_PADRAO)
  })

  it('com relógio falso, remove só TentativaAcesso > 24 h e Sessao expiradas/revogadas há > 30 dias', async () => {
    await prismaTeste.tentativaAcesso.createMany({
      data: [
        { tipo: 'LOGIN_FALHA', chave: 'velha', criadoEm: antes(RETENCAO_TENTATIVAS_MS + 1) },
        { tipo: 'LOGIN_FALHA', chave: 'limite', criadoEm: antes(RETENCAO_TENTATIVAS_MS) },
        { tipo: 'CADASTRO', chave: 'recente', criadoEm: antes(1000) },
      ],
    })
    const { id: usuarioId } = await criarUsuario({ atleticaId: padraoId })
    const sessao = (dados: { expiraEm: Date; revogadaEm?: Date }) =>
      criarSessao({ usuarioId, atleticaId: padraoId, ...dados })
    const expiradaHaMuito = await sessao({ expiraEm: antes(RETENCAO_SESSOES_ENCERRADAS_MS + 1) })
    const revogadaHaMuito = await sessao({
      expiraEm: depois(1000),
      revogadaEm: antes(RETENCAO_SESSOES_ENCERRADAS_MS + 1),
    })
    const expiradaRecente = await sessao({ expiraEm: antes(1000) })
    const revogadaRecente = await sessao({ expiraEm: depois(1000), revogadaEm: antes(1000) })
    const ativa = await sessao({ expiraEm: depois(1000) })

    const resultado = await contexto.app.get(LimpezaDiariaJob).limpar(AGORA)

    expect(resultado).toEqual({ tentativasAcesso: 1, sessoes: 2, codigosVerificacao: 0 })
    const chaves = (await prismaTeste.tentativaAcesso.findMany()).map(({ chave }) => chave)
    expect(chaves.sort()).toEqual(['limite', 'recente'])
    const restantes = (await prismaTeste.sessao.findMany()).map(({ id }) => id)
    expect(restantes.sort()).toEqual([expiradaRecente.id, revogadaRecente.id, ativa.id].sort())
    expect(restantes).not.toContain(expiradaHaMuito.id)
    expect(restantes).not.toContain(revogadaHaMuito.id)
  })

  it('com relógio falso, remove só CodigoVerificacao criados há mais de 24 h', async () => {
    const { id: usuarioId } = await criarUsuario({ atleticaId: padraoId })
    const codigo = (
      criadoEm: Date,
      tipo: 'RECUPERAR_SENHA' | 'VERIFICAR_EMAIL' = 'RECUPERAR_SENHA',
    ) =>
      prismaTeste.codigoVerificacao.create({
        data: { usuarioId, tipo, codigoHash: 'x', criadoEm, expiraEm: depois(1000) },
      })
    await codigo(antes(RETENCAO_CODIGOS_MS + 1))
    await codigo(antes(RETENCAO_CODIGOS_MS + 1), 'VERIFICAR_EMAIL')
    const noLimite = await codigo(antes(RETENCAO_CODIGOS_MS))
    const recente = await codigo(antes(1000))

    const resultado = await contexto.app.get(LimpezaDiariaJob).limpar(AGORA)

    expect(resultado.codigosVerificacao).toBe(2)
    const restantes = (await prismaTeste.codigoVerificacao.findMany()).map(({ id }) => id)
    expect(restantes.sort()).toEqual([noLimite.id, recente.id].sort())
  })

  it('executar (chamado pelo cron) não propaga falhas', async () => {
    const job = contexto.app.get(LimpezaDiariaJob)
    const limpar = jest.spyOn(job, 'limpar').mockRejectedValueOnce(new Error('banco fora'))

    await expect(job.executar()).resolves.toBeUndefined()
    expect(limpar).toHaveBeenCalledWith()
  })
})
