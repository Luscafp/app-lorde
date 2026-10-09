import { capturarErroJob } from '../sentry/sentry'
import { ehUltimaTentativa, executarJob, type DependenciasJob, type JobFila } from './executar-job'

jest.mock('../sentry/sentry', () => ({ capturarErroJob: jest.fn() }))

function job<T>(data: T, tentativa: { retryCount: number; retryLimit: number }): JobFila<T> {
  return { id: 'job-1', name: 'teste.fila', data, ...tentativa } as JobFila<T>
}

function dependencias() {
  const executarComAtletica = jest.fn((_id: string, fn: () => unknown) => Promise.resolve(fn()))
  return {
    executarComAtletica,
    contexto: { executarComAtletica } as unknown as DependenciasJob['contexto'],
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }
}

describe('executarJob', () => {
  beforeEach(() => jest.mocked(capturarErroJob).mockClear())

  it('roda no contexto da atlética do payload e loga a conclusão', async () => {
    const deps = dependencias()
    const handler = jest.fn().mockResolvedValue(undefined)
    const atual = job({ atleticaId: 'atl-1', valor: 1 }, { retryCount: 0, retryLimit: 2 })

    await executarJob(atual, handler, deps)

    expect(deps.executarComAtletica).toHaveBeenCalledWith('atl-1', expect.any(Function))
    expect(handler).toHaveBeenCalledWith(atual.data, atual)
    expect(deps.logger.log).toHaveBeenCalledWith(
      { fila: 'teste.fila', jobId: 'job-1', tentativa: 1 },
      'Job concluído',
    )
  })

  it('sem atleticaId no payload, roda fora do contexto de atlética', async () => {
    const deps = dependencias()
    const handler = jest.fn().mockResolvedValue(undefined)

    await executarJob(job({ valor: 1 }, { retryCount: 0, retryLimit: 0 }), handler, deps)
    await executarJob(job(null, { retryCount: 0, retryLimit: 0 }), handler, deps)

    expect(deps.executarComAtletica).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('falha com tentativas restantes: loga aviso, relança e não vai ao Sentry', async () => {
    const deps = dependencias()
    const erro = new Error('falhou')

    await expect(
      executarJob(
        job({}, { retryCount: 1, retryLimit: 3 }),
        jest.fn().mockRejectedValue(erro),
        deps,
      ),
    ).rejects.toBe(erro)

    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fila: 'teste.fila', jobId: 'job-1', tentativa: 2, err: erro }),
      expect.any(String),
    )
    expect(capturarErroJob).not.toHaveBeenCalled()
  })

  it('falha na última tentativa: loga erro e envia ao Sentry sem o payload', async () => {
    const deps = dependencias()
    const erro = new Error('falhou de vez')

    await expect(
      executarJob(
        job({ atleticaId: 'atl-1', email: 'a@b.com' }, { retryCount: 3, retryLimit: 3 }),
        jest.fn().mockRejectedValue(erro),
        deps,
      ),
    ).rejects.toBe(erro)

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ tentativa: 4, err: erro }),
      expect.any(String),
    )
    expect(capturarErroJob).toHaveBeenCalledWith('teste.fila', erro, {
      jobId: 'job-1',
      tentativa: 4,
    })
  })
})

describe('ehUltimaTentativa', () => {
  it('é a última quando retryCount alcança retryLimit', () => {
    expect(ehUltimaTentativa({ retryCount: 0, retryLimit: 0 })).toBe(true)
    expect(ehUltimaTentativa({ retryCount: 1, retryLimit: 2 })).toBe(false)
    expect(ehUltimaTentativa({ retryCount: 2, retryLimit: 2 })).toBe(true)
  })
})
