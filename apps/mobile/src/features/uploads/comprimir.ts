import { LARGURA_MAXIMA_IMAGEM, TAMANHO_MAXIMO_IMAGEM } from '@atletica/shared'
import { getInfoAsync } from 'expo-file-system/legacy'
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator'

export const MENSAGEM_IMAGEM_GRANDE = 'Imagem muito grande. Escolha outra imagem.'
export const MENSAGEM_FORMATO_INVALIDO = 'Formato de imagem não suportado.'

const QUALIDADES = [0.8, 0.6, 0.4] as const

export class ErroImagem extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroImagem'
  }
}

export type ImagemComprimida = {
  uri: string
  largura: number
  altura: number
  tamanhoBytes: number
}

async function decodificar(uri: string): Promise<ImageRef> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync()
    if (original.width <= LARGURA_MAXIMA_IMAGEM) return original
    return await ImageManipulator.manipulate(original)
      .resize({ width: LARGURA_MAXIMA_IMAGEM })
      .renderAsync()
  } catch {
    throw new ErroImagem(MENSAGEM_FORMATO_INVALIDO)
  }
}

async function tamanhoDoArquivo(uri: string): Promise<number> {
  const info = await getInfoAsync(uri)
  if (!info.exists) throw new ErroImagem(MENSAGEM_FORMATO_INVALIDO)
  return info.size
}

/** RNF04: JPEG com no máximo 1080 px de largura e 5 MB (qualidade 0,8 → 0,6 → 0,4). */
export async function comprimir(uri: string): Promise<ImagemComprimida> {
  const imagem = await decodificar(uri)
  for (const qualidade of QUALIDADES) {
    const salva = await imagem.saveAsync({ compress: qualidade, format: SaveFormat.JPEG })
    const tamanhoBytes = await tamanhoDoArquivo(salva.uri)
    if (tamanhoBytes <= TAMANHO_MAXIMO_IMAGEM) {
      return { uri: salva.uri, largura: salva.width, altura: salva.height, tamanhoBytes }
    }
  }
  throw new ErroImagem(MENSAGEM_IMAGEM_GRANDE)
}
