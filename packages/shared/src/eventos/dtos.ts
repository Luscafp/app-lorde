import { z } from 'zod'
import { Resultado, StatusEvento, TipoEvento } from '../enums/evento'

/** Resposta de `POST /eventos` e `PATCH /eventos/:id`; a #75 estende. */
export const eventoDtoSchema = z
  .object({
    id: z.uuid(),
    tipo: z.enum(TipoEvento),
    status: z.enum(StatusEvento),
    inicio: z.iso.datetime(),
    local: z.string(),
    observacoes: z.string().nullable(),
    serieId: z.uuid().nullable(),
    time: z.object({ id: z.uuid(), nome: z.string() }).strict(),
    /** Derivada do time (RN10). */
    modalidade: z.object({ id: z.uuid(), nome: z.string(), icone: z.string() }).strict(),
    /** `null` em Treino. */
    timeAdversario: z
      .object({
        id: z.uuid(),
        nome: z.string(),
        atletica: z
          .object({ id: z.uuid(), nome: z.string(), sigla: z.string().nullable() })
          .strict(),
      })
      .strict()
      .nullable(),
    placarTime: z.number().int().nullable(),
    placarAdversario: z.number().int().nullable(),
    resultado: z.enum(Resultado).nullable(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .strict()

/** Resposta de `POST /eventos/:id/cancelar`. */
export const eventoCanceladoDtoSchema = z
  .object({
    eventoIds: z.array(z.uuid()),
    status: z.literal(StatusEvento.CANCELADO),
  })
  .strict()

export type EventoDto = z.infer<typeof eventoDtoSchema>
export type EventoCanceladoDto = z.infer<typeof eventoCanceladoDtoSchema>
