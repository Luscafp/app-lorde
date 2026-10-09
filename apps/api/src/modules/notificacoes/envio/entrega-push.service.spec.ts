import type { FilaService } from '../../../infra/fila/fila.service'
import type { MensagemPush } from '../../../infra/fila/filas-dominio'
import { capturarErroJob } from '../../../infra/sentry/sentry'
import type { DispositivosService } from '../dispositivos/dispositivos.service'
import { EntregaPushService, ehFalhaTemporaria, ESPERA_RECIBOS_MS } from './entrega-push.service'
import { FakeExpoPush } from './fake-expo-push'

jest.mock('../../../infra/sentry/sentry', () => ({ capturarErroJob: jest.fn() }))

const mensagem = (to: string): MensagemPush => ({
  to,
  title: 'Título',
  body: 'Corpo',
  data: { url: '/', tipo: 'AVISOS', id: 'aviso:1' },
  channelId: 'padrao',
  sound: 'default',
  priority: 'high',
})

function preparar() {
  const removerInvalidos = jest.fn().mockResolvedValue(undefined)
  const dispositivos = { removerInvalidos } as unknown as DispositivosService
  const fila = { enviar: jest.fn().mockResolvedValue('job-1') }
  const expo = new FakeExpoPush()
  const servico = new EntregaPushService(fila as unknown as FilaService, expo, dispositivos)
  return { servico, expo, fila, removerInvalidos }
}

const lote = (...tokens: string[]) => ({
  entregas: tokens.map((token) => ({ dispositivoId: `d-${token}`, mensagem: mensagem(token) })),
})

const apagados = (removerInvalidos: jest.Mock) =>
  (removerInvalidos.mock.calls as [string[]][]).flatMap(([ids]) => ids)

describe('EntregaPushService', () => {
  beforeEach(() => jest.mocked(capturarErroJob).mockClear())

  describe('enviarLote', () => {
    it('envia o lote numa requisição e agenda os recibos para 15 min depois', async () => {
      const { servico, expo, fila, removerInvalidos } = preparar()
      const antes = Date.now()

      await servico.enviarLote(lote('A', 'B'))

      expect(expo.requisicoes()).toHaveLength(1)
      expect(expo.enviadas().map(({ to }) => to)).toEqual(['A', 'B'])
      expect(fila.enviar).toHaveBeenCalledWith(
        'notificacao.recibos',
        {
          tickets: [
            { ticketId: 'ticket-1', dispositivoId: 'd-A' },
            { ticketId: 'ticket-2', dispositivoId: 'd-B' },
          ],
        },
        { startAfter: expect.any(Date) as Date },
      )
      const [, , opcoes] = fila.enviar.mock.calls[0] as [string, unknown, { startAfter: Date }]
      expect(opcoes.startAfter.getTime()).toBeGreaterThanOrEqual(antes + ESPERA_RECIBOS_MS)
      expect(apagados(removerInvalidos)).toEqual([])
    })

    it('DeviceNotRegistered no ticket apaga o dispositivo e não consulta recibo dele', async () => {
      const { servico, expo, fila, removerInvalidos } = preparar()
      expo.simularErroTicket('B', 'DeviceNotRegistered')

      await servico.enviarLote(lote('A', 'B'))

      expect(removerInvalidos).toHaveBeenCalledWith(['d-B'])
      expect(fila.enviar).toHaveBeenCalledWith(
        'notificacao.recibos',
        { tickets: [{ ticketId: 'ticket-1', dispositivoId: 'd-A' }] },
        expect.anything(),
      )
    })

    it.each(['MessageTooBig', 'InvalidCredentials', 'MismatchSenderId'] as const)(
      '%s no ticket vai ao Sentry sem apagar',
      async (erro) => {
        const { servico, expo, fila, removerInvalidos } = preparar()
        expo.simularErroTicket('A', erro)

        await servico.enviarLote(lote('A'))

        expect(capturarErroJob).toHaveBeenCalledWith(
          'notificacao.enviar-lote',
          expect.objectContaining({ name: 'ErroExpoPush', message: erro }),
          { dispositivoId: 'd-A', codigo: erro },
        )
        expect(apagados(removerInvalidos)).toEqual([])
        expect(fila.enviar).not.toHaveBeenCalled()
      },
    )

    it('código desconhecido no ticket vai ao Sentry sem apagar', async () => {
      const { servico, expo, removerInvalidos } = preparar()
      expo.simularErroTicket('A', 'ProviderError')

      await servico.enviarLote(lote('A'))

      expect(capturarErroJob).toHaveBeenCalledWith(
        'notificacao.enviar-lote',
        expect.objectContaining({ message: 'ProviderError' }),
        { dispositivoId: 'd-A', codigo: 'ProviderError' },
      )
      expect(apagados(removerInvalidos)).toEqual([])
    })

    it('MessageRateExceeded só gera aviso', async () => {
      const { servico, expo, removerInvalidos } = preparar()
      expo.simularErroTicket('A', 'MessageRateExceeded')

      await servico.enviarLote(lote('A'))

      expect(capturarErroJob).not.toHaveBeenCalled()
      expect(apagados(removerInvalidos)).toEqual([])
    })

    it('503 relança para o pg-boss repetir o lote', async () => {
      const { servico, expo, fila } = preparar()
      expo.simularIndisponibilidade()

      await expect(servico.enviarLote(lote('A'))).rejects.toMatchObject({ statusCode: 503 })
      expect(fila.enviar).not.toHaveBeenCalled()

      await servico.enviarLote(lote('A'))
      expect(expo.enviadas()).toHaveLength(1)
    })

    it('4xx do Expo não repete: vai ao Sentry só com status e código', async () => {
      const { servico, expo } = preparar()
      const recusa = Object.assign(new Error('ExponentPushToken[A] de outro projeto'), {
        statusCode: 400,
        code: 'PUSH_TOO_MANY_EXPERIENCE_IDS',
      })
      jest.spyOn(expo, 'enviar').mockRejectedValue(recusa)

      await expect(servico.enviarLote(lote('A'))).resolves.toBeUndefined()

      expect(capturarErroJob).toHaveBeenCalledWith(
        'notificacao.enviar-lote',
        expect.objectContaining({ message: 'HTTP 400 PUSH_TOO_MANY_EXPERIENCE_IDS' }),
        { mensagens: 1 },
      )
    })

    it('erro sem status HTTP que não é de rede não repete e vai ao Sentry', async () => {
      const { servico, expo } = preparar()
      const falha = new Error('Expected Expo to respond with 1 ticket but got 0')
      jest.spyOn(expo, 'enviar').mockRejectedValue(falha)

      await expect(servico.enviarLote(lote('A'))).resolves.toBeUndefined()

      expect(capturarErroJob).toHaveBeenCalledWith('notificacao.enviar-lote', falha, {
        mensagens: 1,
      })
    })

    it('falha depois do envio não relança (o lote não é reenviado)', async () => {
      const { servico, fila } = preparar()
      fila.enviar.mockRejectedValue(new Error('banco fora'))

      await expect(servico.enviarLote(lote('A'))).resolves.toBeUndefined()

      expect(capturarErroJob).toHaveBeenCalledWith('notificacao.enviar-lote', expect.any(Error))
    })
  })

  describe('processarRecibos', () => {
    async function ticketsDe(servico: EntregaPushService, fila: { enviar: jest.Mock }) {
      await servico.enviarLote(lote('A', 'B', 'C'))
      const [, payload] = fila.enviar.mock.calls[0] as [string, { tickets: object[] }]
      return payload
    }

    it('DeviceNotRegistered no recibo apaga o dispositivo', async () => {
      const { servico, expo, fila, removerInvalidos } = preparar()
      expo.simularErroRecibo('B', 'DeviceNotRegistered')
      expo.simularErroRecibo('C', 'InvalidCredentials')

      await servico.processarRecibos(
        (await ticketsDe(servico, fila)) as Parameters<typeof servico.processarRecibos>[0],
      )

      expect(removerInvalidos).toHaveBeenCalledWith(['d-B'])
      expect(capturarErroJob).toHaveBeenCalledWith(
        'notificacao.recibos',
        expect.objectContaining({ message: 'InvalidCredentials' }),
        { dispositivoId: 'd-C', codigo: 'InvalidCredentials' },
      )
    })

    it('recibos ok ou ainda ausentes não apagam nada', async () => {
      const { servico, removerInvalidos } = preparar()

      await servico.processarRecibos({
        tickets: [{ ticketId: 'desconhecido', dispositivoId: 'd-X' }],
      })

      expect(apagados(removerInvalidos)).toEqual([])
    })
  })
})

describe('ehFalhaTemporaria', () => {
  it.each([
    [new TypeError('fetch failed'), true],
    [new Error('ECONNRESET'), false],
    [new TypeError('Cannot read properties of undefined'), false],
    [{ statusCode: 500 }, true],
    [{ statusCode: 503 }, true],
    [{ statusCode: 429 }, true],
    [{ statusCode: 400 }, false],
    [{ statusCode: 401 }, false],
  ])('%p → %p', (erro, esperado) => {
    expect(ehFalhaTemporaria(erro)).toBe(esperado)
  })
})
