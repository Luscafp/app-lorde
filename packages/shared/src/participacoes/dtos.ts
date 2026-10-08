import { z } from 'zod'
import { StatusEvento } from '../enums/evento'
import { RespostaPresenca } from './presenca'

/** Respostas do elenco atual do time. */
export const contagemParticipacaoSchema = z
  .object({
    confirmados: z.number().int(),
    recusados: z.number().int(),
    semResposta: z.number().int(),
    elenco: z.number().int(),
  })
  .strict()

/** Resposta de `PUT /eventos/:id/participacao` (#24). */
export const participacaoRespondidaDtoSchema = z
  .object({
    eventoId: z.uuid(),
    confirmado: z.boolean(),
    respondidoEm: z.iso.datetime(),
    contagem: contagemParticipacaoSchema,
  })
  .strict()

export const itemPresencaSchema = z
  .object({
    usuarioId: z.uuid(),
    nome: z.string(),
    fotoUrl: z.string().nullable(),
    resposta: z.enum(RespostaPresenca),
    /** Valor salvo; sem chamada registrada, pré-preenchido com `confirmado = true`. */
    presente: z.boolean(),
  })
  .strict()

/** `GET` e `PUT /eventos/:id/presencas` (#84): elenco do evento por nome, sem paginação. */
export const listaPresencaDtoSchema = z
  .object({
    eventoId: z.uuid(),
    status: z.enum(StatusEvento),
    registrada: z.boolean(),
    registradaEm: z.iso.datetime().nullable(),
    itens: z.array(itemPresencaSchema),
  })
  .strict()

export type ParticipacaoRespondidaDto = z.infer<typeof participacaoRespondidaDtoSchema>
export type ContagemParticipacao = z.infer<typeof contagemParticipacaoSchema>
export type ItemPresenca = z.infer<typeof itemPresencaSchema>
export type ListaPresencaDto = z.infer<typeof listaPresencaDtoSchema>
