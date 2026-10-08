import { z } from 'zod'
import { Resultado, StatusEvento, TipoEvento } from '../enums/evento'
import { contagemParticipacaoSchema } from '../participacoes/dtos'
import { respostaPaginadaSchema } from '../utils/paginacao'
import { MotivoBloqueioResposta } from './participacao'

/** Resposta de `POST /eventos` e `PATCH /eventos/:id`; base do detalhe. */
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

const ocorrenciaSchema = z.object({ id: z.uuid(), inicio: z.iso.datetime() }).strict()

/** Resposta de `POST /eventos` com `recorrencia` (#20). */
export const serieCriadaDtoSchema = z
  .object({
    serie: z
      .object({
        id: z.uuid(),
        timeId: z.uuid(),
        diasSemana: z.array(z.number().int()),
        horario: z.string(),
        dataInicio: z.iso.date(),
        dataFim: z.iso.date(),
      })
      .strict(),
    totalOcorrencias: z.number().int(),
    primeiraOcorrencia: ocorrenciaSchema,
    ultimaOcorrencia: ocorrenciaSchema,
  })
  .strict()

/** Resposta de `PATCH /eventos/:id` com `escopo = ESTA_E_SEGUINTES`. */
export const ocorrenciasAlteradasDtoSchema = z
  .object({
    eventoIds: z.array(z.uuid()),
    serieId: z.uuid(),
    serieDividida: z.boolean(),
  })
  .strict()

/** Resposta do usuário do token; `null` sem resposta. */
export const minhaParticipacaoSchema = z
  .object({ confirmado: z.boolean(), respondidoEm: z.iso.datetime() })
  .strict()
  .nullable()

/** Item de `GET /eventos`. */
export const eventoResumoSchema = eventoDtoSchema
  .omit({ observacoes: true, criadoEm: true, atualizadoEm: true })
  .extend({ souMembro: z.boolean(), minhaParticipacao: minhaParticipacaoSchema })
  .strict()

export const listaEventosSchema = respostaPaginadaSchema(eventoResumoSchema)

/** `GET /eventos/:id` (épico #22 §7). */
export const eventoDetalheSchema = eventoDtoSchema
  .extend({
    serie: z
      .object({
        id: z.uuid(),
        diasSemana: z.array(z.number().int()),
        horario: z.string(),
        dataInicio: z.iso.date(),
        dataFim: z.iso.date(),
      })
      .strict()
      .nullable(),
    contagem: contagemParticipacaoSchema,
    /** "Quem vai": membros atuais com `confirmado = true`. */
    confirmados: z.array(
      z
        .object({
          id: z.uuid(),
          nome: z.string(),
          fotoUrl: z.string().nullable(),
          capitao: z.boolean(),
        })
        .strict(),
    ),
    souMembro: z.boolean(),
    minhaParticipacao: minhaParticipacaoSchema,
    podeResponder: z.boolean(),
    motivoBloqueioResposta: z.enum(MotivoBloqueioResposta).nullable(),
  })
  .strict()

/** Resposta de `PATCH /eventos/:id/status`; sem mudança, `statusAnterior` = `status`. */
export const statusEventoAlteradoDtoSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(StatusEvento),
    statusAnterior: z.enum(StatusEvento),
  })
  .strict()

export type EventoDto = z.infer<typeof eventoDtoSchema>
export type EventoCanceladoDto = z.infer<typeof eventoCanceladoDtoSchema>
export type SerieCriadaDto = z.infer<typeof serieCriadaDtoSchema>
export type OcorrenciasAlteradasDto = z.infer<typeof ocorrenciasAlteradasDtoSchema>
export type MinhaParticipacao = z.infer<typeof minhaParticipacaoSchema>
export type EventoResumoDto = z.infer<typeof eventoResumoSchema>
export type ListaEventos = z.infer<typeof listaEventosSchema>
export type EventoDetalheDto = z.infer<typeof eventoDetalheSchema>
export type StatusEventoAlteradoDto = z.infer<typeof statusEventoAlteradoDtoSchema>
