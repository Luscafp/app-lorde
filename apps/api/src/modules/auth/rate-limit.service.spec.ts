import { LIMITE_LOGIN } from './auth.service'
import { avaliarLimite, type LimiteTentativas } from './rate-limit.service'

const MINUTO = 60_000
const t0 = new Date('2026-10-04T12:00:00.000Z')
const em = (minutos: number) => new Date(t0.getTime() + minutos * MINUTO)

/** Tentativas nos minutos informados, da mais recente para a mais antiga. */
const tentativas = (...minutos: number[]) => minutos.map(em).reverse()

describe('avaliarLimite', () => {
  it('sem tentativas → liberado com todas as restantes', () => {
    expect(avaliarLimite([], LIMITE_LOGIN, t0)).toEqual({ restantes: 5, bloqueadoAte: null })
  })

  it('4 falhas → liberado, 1 restante', () => {
    expect(avaliarLimite(tentativas(0, 1, 2, 3), LIMITE_LOGIN, em(4))).toEqual({
      restantes: 1,
      bloqueadoAte: null,
    })
  })

  it('5ª falha → bloqueado até t5 + 15 min', () => {
    const recentes = tentativas(0, 1, 2, 3, 4)
    expect(avaliarLimite(recentes, LIMITE_LOGIN, em(4))).toEqual({
      restantes: 0,
      bloqueadoAte: em(19),
    })
    expect(avaliarLimite(recentes, LIMITE_LOGIN, em(18.99)).bloqueadoAte).toEqual(em(19))
  })

  it('bloqueio termina em t5 + 15 min', () => {
    expect(avaliarLimite(tentativas(0, 1, 2, 3, 4), LIMITE_LOGIN, em(19))).toEqual({
      restantes: 5,
      bloqueadoAte: null,
    })
  })

  it('5 falhas espalhadas por mais de 15 min não bloqueiam', () => {
    expect(avaliarLimite(tentativas(0, 5, 10, 14, 15.01), LIMITE_LOGIN, em(15.02))).toEqual({
      restantes: 1,
      bloqueadoAte: null,
    })
  })

  it('t5 − t1 = 15 min ainda bloqueia', () => {
    expect(avaliarLimite(tentativas(0, 5, 10, 14, 15), LIMITE_LOGIN, em(15)).bloqueadoAte).toEqual(
      em(30),
    )
  })

  it('falhas fora da janela não contam', () => {
    expect(avaliarLimite(tentativas(0, 1), LIMITE_LOGIN, em(16)).restantes).toBe(5)
    expect(avaliarLimite(tentativas(0, 10), LIMITE_LOGIN, em(16)).restantes).toBe(4)
  })

  it('bloqueioMs diferente da janela', () => {
    const limite = { maximo: 2, janelaMs: MINUTO, bloqueioMs: 10 * MINUTO }
    expect(avaliarLimite(tentativas(0, 0.5), limite, em(5)).bloqueadoAte).toEqual(em(10.5))
  })

  describe('sem bloqueioMs: janela deslizante', () => {
    const HORA: LimiteTentativas = { maximo: 3, janelaMs: 60 * MINUTO }

    it('libera quando a mais antiga das `maximo` sai da janela', () => {
      const recentes = tentativas(0, 50, 59)
      expect(avaliarLimite(recentes, HORA, em(59))).toEqual({ restantes: 0, bloqueadoAte: em(60) })
      expect(avaliarLimite(recentes, HORA, em(60)).bloqueadoAte).toBeNull()
    })

    it('tentativas fora da janela não bloqueiam', () => {
      expect(avaliarLimite(tentativas(0, 50, 61), HORA, em(61)).bloqueadoAte).toBeNull()
    })
  })
})
