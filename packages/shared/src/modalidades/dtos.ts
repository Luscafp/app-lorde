import { z } from 'zod'

/** `icone` como texto livre: chave fora do catálogo vira o ícone padrão no app. */
export const modalidadeSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    icone: z.string(),
    ativa: z.boolean(),
  })
  .strict()

/** `GET /modalidades`: sem paginação (convenções §4.4). */
export const listaModalidadesSchema = z.object({ items: z.array(modalidadeSchema) }).strict()

export type Modalidade = z.infer<typeof modalidadeSchema>
export type ListaModalidades = z.infer<typeof listaModalidadesSchema>
