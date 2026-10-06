import { z } from 'zod'
import { Resultado } from '../enums/evento'

export const PLACAR_MAX = 999

/** Do ponto de vista da atlética dona do evento (RN17). */
export function calcularResultado(placarTime: number, placarAdversario: number): Resultado {
  if (placarTime > placarAdversario) return Resultado.VITORIA
  if (placarTime < placarAdversario) return Resultado.DERROTA
  return Resultado.EMPATE
}

const placarSchema = z
  .number({ error: 'Informe o placar.' })
  .int({ error: 'O placar deve ser um número inteiro.' })
  .min(0, { error: `O placar deve estar entre 0 e ${PLACAR_MAX}.` })
  .max(PLACAR_MAX, { error: `O placar deve estar entre 0 e ${PLACAR_MAX}.` })

/** `resultado` nunca vem do cliente; `finalizar` finaliza o jogo na mesma transação (UC17 A1). */
export const resultadoSchema = z
  .object({
    placarTime: placarSchema,
    placarAdversario: placarSchema,
    finalizar: z.boolean().optional(),
  })
  .strict()

export type RegistrarResultado = z.infer<typeof resultadoSchema>
export type RegistrarResultadoForm = z.input<typeof resultadoSchema>
