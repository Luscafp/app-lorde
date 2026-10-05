import type { ErroNegocio } from '../../common/erros/erro-negocio'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { EventosValidator } from './eventos.validator'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const ADVERSARIA = 'a2a2a2a2-0000-4000-8000-000000000002'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const ADVERSARIO = 'b2b2b2b2-0000-4000-8000-000000000002'
const VOLEI = 'c1c1c1c1-0000-4000-8000-000000000001'
const FUTSAL = 'c2c2c2c2-0000-4000-8000-000000000002'

function linhaTime(dados: Record<string, unknown> = {}) {
  return {
    atleticaId: ATUAL,
    ativo: true,
    modalidadeId: VOLEI,
    modalidade: { ativa: true },
    ...dados,
  }
}

function transacao(time: ReturnType<typeof linhaTime> | null) {
  const findUnique = jest.fn().mockResolvedValue(time)
  return { tx: { time: { findUnique } } as unknown as TransacaoComEscopo, findUnique }
}

async function codigoDe(promessa: Promise<unknown>): Promise<string> {
  const erro = (await promessa.then(
    () => {
      throw new Error('esperava erro')
    },
    (e: unknown) => e,
  )) as ErroNegocio
  return erro.code
}

describe('EventosValidator', () => {
  const validator = new EventosValidator()

  describe('validarTime', () => {
    it('time ativo da atlética devolve a modalidade', async () => {
      const { tx } = transacao(linhaTime())
      await expect(validator.validarTime(tx, TIME, ATUAL)).resolves.toEqual({
        id: TIME,
        modalidadeId: VOLEI,
      })
    })

    it.each([
      ['inexistente', null, 'TIME_INVALIDO'],
      ['de outra atlética', linhaTime({ atleticaId: ADVERSARIA }), 'TIME_INVALIDO'],
      ['inativo', linhaTime({ ativo: false }), 'TIME_INATIVO'],
      ['de modalidade inativa', linhaTime({ modalidade: { ativa: false } }), 'MODALIDADE_INATIVA'],
    ])('%s → %s', async (_caso, time, codigo) => {
      const { tx } = transacao(time)
      await expect(codigoDe(validator.validarTime(tx, TIME, ATUAL))).resolves.toBe(codigo)
    })
  })

  describe('validarAdversario (RN11)', () => {
    const time = { id: TIME, modalidadeId: VOLEI }

    it('mesma modalidade, outra atlética e ativo → ok', async () => {
      const { tx } = transacao(linhaTime({ atleticaId: ADVERSARIA }))
      await expect(validator.validarAdversario(tx, ADVERSARIO, time, ATUAL)).resolves.toBe(
        undefined,
      )
    })

    it('modalidades diferentes → MODALIDADES_DIFERENTES', async () => {
      const { tx } = transacao(linhaTime({ atleticaId: ADVERSARIA, modalidadeId: FUTSAL }))
      await expect(
        codigoDe(validator.validarAdversario(tx, ADVERSARIO, time, ATUAL)),
      ).resolves.toBe('MODALIDADES_DIFERENTES')
    })

    it('igual ao timeId → ADVERSARIO_INVALIDO sem consultar', async () => {
      const { tx, findUnique } = transacao(linhaTime())
      await expect(codigoDe(validator.validarAdversario(tx, TIME, time, ATUAL))).resolves.toBe(
        'ADVERSARIO_INVALIDO',
      )
      expect(findUnique).not.toHaveBeenCalled()
    })

    it.each([
      ['inexistente', null],
      ['da própria atlética', linhaTime()],
      ['inativo', linhaTime({ atleticaId: ADVERSARIA, ativo: false })],
    ])('%s → ADVERSARIO_INVALIDO', async (_caso, adversario) => {
      const { tx } = transacao(adversario)
      await expect(
        codigoDe(validator.validarAdversario(tx, ADVERSARIO, time, ATUAL)),
      ).resolves.toBe('ADVERSARIO_INVALIDO')
    })
  })
})
