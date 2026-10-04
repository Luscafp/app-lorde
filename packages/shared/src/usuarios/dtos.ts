import { z } from 'zod'
import { Papel } from '../enums/papel'
import { respostaPaginadaSchema } from '../utils/paginacao'
import { SITUACOES_FILTRO, SituacaoUsuario } from './schemas'

export const usuarioResumoSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    email: z.string(),
    fotoUrl: z.string().nullable(),
    papel: z.enum(Papel),
    situacao: z.enum(SITUACOES_FILTRO),
  })
  .strict()

export const listaUsuariosSchema = respostaPaginadaSchema(usuarioResumoSchema)

/** Calculadas no backend para o solicitante (RNF07); o app só as reflete. */
export const permissoesUsuarioSchema = z
  .object({
    podeAlterarSituacao: z.boolean(),
    motivoBloqueio: z.string().nullable(),
    podeAlterarPapel: z.boolean(),
    ehUltimoAdministrador: z.boolean(),
  })
  .strict()

export const timeDoUsuarioSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    modalidade: z.object({ id: z.uuid(), nome: z.string() }).strict(),
    capitao: z.boolean(),
  })
  .strict()

export const usuarioDetalheSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    email: z.string(),
    fotoUrl: z.string().nullable(),
    papel: z.enum(Papel),
    situacao: z.enum(SituacaoUsuario),
    criadoEm: z.iso.datetime(),
    times: z.array(timeDoUsuarioSchema),
    /** Preenchido pela #35 (R2). */
    estatisticas: z.null(),
    permissoes: permissoesUsuarioSchema,
  })
  .strict()

export const situacaoAlteradaSchema = z
  .object({ id: z.uuid(), situacao: z.enum(SITUACOES_FILTRO) })
  .strict()

export type UsuarioResumo = z.infer<typeof usuarioResumoSchema>
export type ListaUsuarios = z.infer<typeof listaUsuariosSchema>
export type PermissoesUsuario = z.infer<typeof permissoesUsuarioSchema>
export type TimeDoUsuario = z.infer<typeof timeDoUsuarioSchema>
export type UsuarioDetalhe = z.infer<typeof usuarioDetalheSchema>
export type SituacaoAlterada = z.infer<typeof situacaoAlteradaSchema>
