import { TAGS_POR_NOTICIA_MAX } from '@atletica/shared'
import type { DadosNoticia } from './dados-noticia'

/** `tags.N` da API aparece no campo de tags. */
export const CAMPOS_DA_API: Record<string, keyof DadosNoticia> = Object.fromEntries(
  Array.from({ length: TAGS_POR_NOTICIA_MAX }, (_, i) => [`tags.${i}`, 'tags'] as const),
)

/** UC21 A4: mensagem única para formato e tamanho da capa. */
export const MENSAGEM_CAPA_INVALIDA = 'Imagem inválida ou maior que 5 MB'

/** Erros de negócio da API que pertencem a um campo, mesmo sem `details`. */
export const CAMPO_DO_ERRO: Record<string, keyof DadosNoticia> = {
  CAPA_OBRIGATORIA: 'imagemCapaKey',
  CONTEUDO_OBRIGATORIO: 'conteudo',
  UPLOAD_INVALIDO: 'imagemCapaKey',
  UPLOAD_NAO_ENCONTRADO: 'imagemCapaKey',
}

export const ERROS_DO_FORMULARIO = ['VALIDATION_ERROR', ...Object.keys(CAMPO_DO_ERRO)]
