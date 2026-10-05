import { Logger } from '@nestjs/common'
import { LimpezaOrfaosJob } from './limpeza-orfaos.job'
import type { LimpezaOrfaosService } from './limpeza-orfaos.service'

describe('LimpezaOrfaosJob', () => {
  let executar: jest.Mock
  let job: LimpezaOrfaosJob

  beforeEach(() => {
    executar = jest.fn().mockResolvedValue(undefined)
    job = new LimpezaOrfaosJob({ executar } as unknown as LimpezaOrfaosService)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('erro geral vai para logger.error sem propagar', async () => {
    const erro = new Error('R2 fora do ar')
    executar.mockRejectedValueOnce(erro)

    await expect(job.executar()).resolves.toBeUndefined()
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      { err: erro, job: 'uploads.limpeza-orfaos' },
      'Falha na limpeza de órfãos',
    )
  })

  it('ignora o disparo enquanto a execução anterior não termina', async () => {
    let terminar: () => void = () => undefined
    executar.mockReturnValueOnce(new Promise<void>((resolve) => (terminar = resolve)))

    const primeira = job.executar()
    await job.executar()
    expect(executar).toHaveBeenCalledTimes(1)
    expect(Logger.prototype.warn).toHaveBeenCalled()

    terminar()
    await primeira
    await job.executar()
    expect(executar).toHaveBeenCalledTimes(2)
  })

  it('libera a trava depois de uma falha', async () => {
    executar.mockRejectedValueOnce(new Error('falha'))

    await job.executar()
    await job.executar()

    expect(executar).toHaveBeenCalledTimes(2)
  })
})
