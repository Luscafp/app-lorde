import { z } from 'zod'

export const ANTECEDENCIAS = [1, 2, 6, 24] as const

export type AntecedenciaLembrete = (typeof ANTECEDENCIAS)[number]

/** Igual ao `@default` de `Preferencia.antecedenciaLembreteHoras`; vale também sem preferência gravada. */
export const ANTECEDENCIA_PADRAO: AntecedenciaLembrete = 2

const interruptor = z.boolean({ error: 'Informe verdadeiro ou falso.' })

/** Corpo de `GET` e `PATCH /me/preferencias-notificacao` (seção 3.4). */
export const preferenciasSchema = z
  .object({
    pushAtivo: interruptor,
    novosEventos: interruptor,
    alteracoesEventos: interruptor,
    lembretes: interruptor,
    antecedenciaLembreteHoras: z.literal(ANTECEDENCIAS, {
      error: 'A antecedência deve ser de 1, 2, 6 ou 24 horas.',
    }),
    resultados: interruptor,
    noticias: interruptor,
    solicitacoes: interruptor,
    avisos: interruptor,
  })
  .strict()

export type Preferencias = z.infer<typeof preferenciasSchema>

/** Resposta de `POST /me/dispositivos`. */
export const dispositivoRegistradoSchema = z.object({
  id: z.uuid(),
  ultimoUsoEm: z.iso.datetime(),
})

export type DispositivoRegistrado = z.infer<typeof dispositivoRegistradoSchema>
