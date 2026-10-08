import {
  noticiaPublicacaoSchema,
  type noticiaRascunhoSchema,
  type NoticiaAtualizacao,
  type NoticiaCriacao,
} from '@atletica/shared'
import type { z } from 'zod'

export type DadosNoticia = z.output<typeof noticiaRascunhoSchema>
export type NomeCampo = keyof DadosNoticia
type Problema = { campo: NomeCampo; mensagem: string }

const publicacaoComCapaAtual = noticiaPublicacaoSchema.omit({ imagemCapaKey: true })

export function paraCriacao(
  { titulo, conteudo = '', imagemCapaKey, tags = [] }: DadosNoticia,
  publicar: boolean,
): NoticiaCriacao {
  return {
    titulo,
    conteudo,
    ...(imagemCapaKey ? { imagemCapaKey } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    publicar,
  }
}

/** Só os campos alterados; `null` remove a capa e `tags` substitui o conjunto. */
export function alteracoes(
  { titulo, conteudo = '', imagemCapaKey, tags = [] }: DadosNoticia,
  alterado: (campo: NomeCampo) => boolean,
): NoticiaAtualizacao {
  return {
    ...(alterado('titulo') ? { titulo } : {}),
    ...(alterado('conteudo') ? { conteudo } : {}),
    ...(alterado('imagemCapaKey') ? { imagemCapaKey: imagemCapaKey ?? null } : {}),
    ...(alterado('tags') ? { tags } : {}),
  }
}

/** A capa já salva não tem chave no app: sem troca, ela atende ao requisito. */
export function problemasDePublicacao(
  { titulo, conteudo = '', imagemCapaKey }: DadosNoticia,
  temCapaSalva: boolean,
): Problema[] {
  const resultado =
    imagemCapaKey === undefined && temCapaSalva
      ? publicacaoComCapaAtual.safeParse({ titulo, conteudo })
      : noticiaPublicacaoSchema.safeParse({ titulo, conteudo, imagemCapaKey })
  return (resultado.error?.issues ?? []).map(({ path: [campo], message }) => ({
    campo: campo as NomeCampo,
    mensagem: message,
  }))
}
