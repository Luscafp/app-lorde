import { medirConsulta } from './consultas-lentas'

describe('medirConsulta', () => {
  function executar(duracaoMs: number, query = jest.fn().mockResolvedValue([])) {
    const logger = { warn: jest.fn() }
    const tempos = [0, duracaoMs]
    const medir = medirConsulta(logger, () => tempos.shift() ?? 0)
    const args = { where: { email: 'fulano@ufma.br' } }
    return { logger, resultado: medir({ model: 'Usuario', operation: 'findMany', args, query }) }
  }

  it('consulta de 600 ms → warn com modelo e operação, sem parâmetros', async () => {
    const { logger, resultado } = executar(600)
    await expect(resultado).resolves.toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      { model: 'Usuario', operation: 'findMany', durationMs: 600 },
      'Consulta lenta',
    )
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('fulano')
  })

  it('consulta de 500 ms ou menos não loga', async () => {
    const { logger, resultado } = executar(500)
    await resultado
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('consulta lenta que falha também é logada e o erro segue', async () => {
    const erro = new Error('x')
    const { logger, resultado } = executar(700, jest.fn().mockRejectedValue(erro))
    await expect(resultado).rejects.toBe(erro)
    expect(logger.warn).toHaveBeenCalled()
  })
})
