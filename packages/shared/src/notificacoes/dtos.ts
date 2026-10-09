import { z } from 'zod'

export const ANTECEDENCIAS = [1, 2, 6, 24] as const

export type AntecedenciaLembrete = (typeof ANTECEDENCIAS)[number]

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
