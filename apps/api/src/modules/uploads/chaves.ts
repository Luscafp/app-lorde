import { randomUUID } from 'node:crypto'
import {
  EXTENSAO_POR_TIPO_IMAGEM,
  FinalidadeUpload,
  FORMATO_CHAVE_UPLOAD,
  type TipoImagem,
} from '@atletica/shared'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MARCADOR = /\{(usuarioId|atleticaId|uuid|ext)\}/g

type Marcador = 'usuarioId' | 'atleticaId' | 'uuid' | 'ext'

const GRUPO: Record<Marcador, string> = {
  usuarioId: `(?<usuarioId>${UUID})`,
  atleticaId: `(?<atleticaId>${UUID})`,
  uuid: UUID,
  ext: `(?:${Object.values(EXTENSAO_POR_TIPO_IMAGEM).join('|')})`,
}

const preencher = (formato: string, valores: Record<Marcador, string>) =>
  formato.replace(MARCADOR, (_, nome: Marcador) => valores[nome])

/** Ancorados: sem `..`, barra extra ou segmento a mais. */
const PADRAO_CHAVE = Object.fromEntries(
  Object.entries(FORMATO_CHAVE_UPLOAD).map(([finalidade, formato]) => [
    finalidade,
    new RegExp(`^${preencher(formato.replaceAll('.', '\\.'), GRUPO)}$`),
  ]),
) as Record<FinalidadeUpload, RegExp>

export interface DonoChave {
  usuarioId: string
  /** Ausente em `PERFIL`: `Usuario` é global. */
  atleticaId?: string
}

export const ehConteudoDaAtletica = (finalidade: FinalidadeUpload) =>
  finalidade !== FinalidadeUpload.PERFIL

export function gerarChave(
  finalidade: FinalidadeUpload,
  contentType: TipoImagem,
  { usuarioId, atleticaId }: Required<DonoChave>,
  uuid: string = randomUUID(),
): string {
  const ext = EXTENSAO_POR_TIPO_IMAGEM[contentType]
  return preencher(FORMATO_CHAVE_UPLOAD[finalidade], { usuarioId, atleticaId, uuid, ext })
}

/** Dono gravado no caminho, ou `null` se a chave não segue o formato da finalidade. */
export function lerChave(key: string, finalidade: FinalidadeUpload): DonoChave | null {
  const grupos = PADRAO_CHAVE[finalidade].exec(key)?.groups
  if (!grupos?.usuarioId) return null
  return { usuarioId: grupos.usuarioId, atleticaId: grupos.atleticaId }
}
