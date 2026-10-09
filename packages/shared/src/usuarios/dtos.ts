import { z } from 'zod'
import { Papel } from '../enums/papel'
import { estatisticasSchema } from '../participacoes/dtos'
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
    estatisticas: estatisticasSchema.nullable(),
    permissoes: permissoesUsuarioSchema,
  })
  .strict()

export const situacaoAlteradaSchema = z
  .object({ id: z.uuid(), situacao: z.enum(SITUACOES_FILTRO) })
  .strict()

const mudancaDePapelSchema = z
  .object({ id: z.uuid(), papelAnterior: z.enum(Papel), papel: z.enum(Papel) })
  .strict()

/** `substituido`: ocupante anterior de Presidente/Vice, rebaixado a Diretor (RN07). */
export const papelAlteradoSchema = z
  .object({
    alterado: z.boolean(),
    usuario: mudancaDePapelSchema,
    substituido: mudancaDePapelSchema.extend({ nome: z.string() }).nullable(),
  })
  .strict()

/** Time atual do usuário autenticado (`GET /me`). */
export const timeDoPerfilSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    modalidade: z.object({ id: z.uuid(), nome: z.string(), icone: z.string() }).strict(),
    capitao: z.boolean(),
    ativo: z.boolean(),
    entradaEm: z.iso.datetime(),
  })
  .strict()

/** `GET /me` e `PATCH /me` (issue #13 §7.1); `papel` é o da atlética do token, lido a cada chamada. */
export const perfilSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    email: z.string(),
    fotoUrl: z.string().nullable(),
    emailVerificado: z.boolean(),
    papel: z.enum(Papel),
    atletica: z.object({ id: z.uuid(), nome: z.string(), sigla: z.string().nullable() }).strict(),
    times: z.array(timeDoPerfilSchema),
    /** Último aceite, consumido pela tela "Termos e privacidade" (#14). */
    termosAceitos: z.object({ versao: z.string(), aceitoEm: z.iso.datetime() }).strict().nullable(),
    criadoEm: z.iso.datetime(),
  })
  .strict()

export const fotoAtualizadaSchema = z.object({ fotoUrl: z.string() }).strict()

export type UsuarioResumo = z.infer<typeof usuarioResumoSchema>
export type ListaUsuarios = z.infer<typeof listaUsuariosSchema>
export type PermissoesUsuario = z.infer<typeof permissoesUsuarioSchema>
export type TimeDoUsuario = z.infer<typeof timeDoUsuarioSchema>
export type UsuarioDetalhe = z.infer<typeof usuarioDetalheSchema>
export type SituacaoAlterada = z.infer<typeof situacaoAlteradaSchema>
export type PapelAlterado = z.infer<typeof papelAlteradoSchema>
export type TimeDoPerfil = z.infer<typeof timeDoPerfilSchema>
export type Perfil = z.infer<typeof perfilSchema>
export type FotoAtualizada = z.infer<typeof fotoAtualizadaSchema>
