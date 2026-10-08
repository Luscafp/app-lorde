import { z } from 'zod'

export const ANTECEDENCIAS = [1, 2, 6, 24] as const

export type AntecedenciaLembrete = (typeof ANTECEDENCIAS)[number]

const interruptor = z.boolean({ error: 'Informe verdadeiro ou falso.' })

/** Seção 3.4; `avisos` só aparece no app com a #38 (R3). */
export const preferenciasSchema = z
  .object({
    pushAtivo: interruptor,
    novosEventos: interruptor,
    alteracoesEventos: interruptor,
    lembretes: interruptor,
    antecedenciaLembreteHoras: z.union([z.literal(1), z.literal(2), z.literal(6), z.literal(24)], {
      error: 'A antecedência deve ser de 1, 2, 6 ou 24 horas.',
    }),
    resultados: interruptor,
    noticias: interruptor,
    solicitacoes: interruptor,
    avisos: interruptor,
  })
  .strict()

/** `.strict()` impede gravar campos não previstos (issue #37 §10). */
export const atualizarPreferenciasSchema = preferenciasSchema
  .partial()
  .strict()
  .refine((valor) => Object.keys(valor).length > 0, { error: 'Informe ao menos um campo.' })

export type Preferencias = z.infer<typeof preferenciasSchema>
export type AtualizarPreferencias = z.infer<typeof atualizarPreferenciasSchema>
