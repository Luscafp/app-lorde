import { randomUUID } from 'node:crypto'
import { EXTENSAO_POR_TIPO_IMAGEM, FinalidadeUpload, type TipoImagem } from '@atletica/shared'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ARQUIVO = `${UUID}\\.(?:${Object.values(EXTENSAO_POR_TIPO_IMAGEM).join('|')})`

const PASTA = { NOTICIA: 'noticias', BANNER: 'banners' } as const

const conteudoDaAtletica = (pasta: string) =>
  new RegExp(`^atleticas/(?<atleticaId>${UUID})/${pasta}/(?<usuarioId>${UUID})/${ARQUIVO}$`)

/** Formatos da convenção §11.5, ancorados: sem `..`, barra extra ou segmento a mais. */
const PADRAO_CHAVE: Record<FinalidadeUpload, RegExp> = {
  PERFIL: new RegExp(`^usuarios/(?<usuarioId>${UUID})/perfil/${ARQUIVO}$`),
  NOTICIA: conteudoDaAtletica(PASTA.NOTICIA),
  BANNER: conteudoDaAtletica(PASTA.BANNER),
}

export interface DonoChave {
  usuarioId: string
  /** Ausente em `PERFIL`: `Usuario` é global (#3). */
  atleticaId?: string
}

export function gerarChave(
  finalidade: FinalidadeUpload,
  contentType: TipoImagem,
  { usuarioId, atleticaId }: Required<DonoChave>,
  uuid: string = randomUUID(),
): string {
  const arquivo = `${uuid}.${EXTENSAO_POR_TIPO_IMAGEM[contentType]}`
  if (finalidade === FinalidadeUpload.PERFIL) return `usuarios/${usuarioId}/perfil/${arquivo}`
  return `atleticas/${atleticaId}/${PASTA[finalidade]}/${usuarioId}/${arquivo}`
}

/** Dono gravado no caminho, ou `null` se a chave não segue o formato da finalidade. */
export function lerChave(key: string, finalidade: FinalidadeUpload): DonoChave | null {
  const grupos = PADRAO_CHAVE[finalidade].exec(key)?.groups
  if (!grupos?.usuarioId) return null
  return { usuarioId: grupos.usuarioId, atleticaId: grupos.atleticaId }
}
