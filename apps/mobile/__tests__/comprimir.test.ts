import { getInfoAsync } from 'expo-file-system/legacy'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import {
  comprimir,
  ErroImagem,
  MENSAGEM_FORMATO_INVALIDO,
  MENSAGEM_IMAGEM_GRANDE,
} from '@/features/uploads/comprimir'

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}))

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }))

const MB = 1024 * 1024

type Dimensoes = { width: number; height: number }

const salvas: { compress: number; format: string; width: number }[] = []
const redimensionamentos: number[] = []

function imagemFalsa({ width, height }: Dimensoes) {
  return {
    width,
    height,
    saveAsync: jest.fn(({ compress, format }: { compress: number; format: string }) => {
      salvas.push({ compress, format, width })
      return Promise.resolve({ uri: `file:///q${compress}.jpg`, width, height })
    }),
  }
}

function prepararImagem(original: Dimensoes, tamanhoPorQualidade: Record<number, number>) {
  jest.mocked(ImageManipulator.manipulate).mockImplementation((origem) => {
    let { width, height } = typeof origem === 'string' ? original : (origem as unknown as Dimensoes)
    const contexto: { resize: jest.Mock; renderAsync: jest.Mock } = {
      resize: jest.fn((tamanho: { width: number }) => {
        redimensionamentos.push(tamanho.width)
        height = Math.round((height * tamanho.width) / width)
        width = tamanho.width
        return contexto
      }),
      renderAsync: jest.fn(() => Promise.resolve(imagemFalsa({ width, height }))),
    }
    return contexto as unknown as ReturnType<typeof ImageManipulator.manipulate>
  })
  jest.mocked(getInfoAsync).mockImplementation((uri) => {
    const qualidade = Number(/q([\d.]+)\.jpg$/.exec(uri)?.[1])
    const size = tamanhoPorQualidade[qualidade] ?? 0
    return Promise.resolve({ exists: true, uri, size, isDirectory: false, modificationTime: 0 })
  })
}

beforeEach(() => {
  salvas.length = 0
  redimensionamentos.length = 0
})

describe('comprimir', () => {
  it('foto de 4000×3000 vira JPEG de 1080 px de largura e ≤ 5 MB na primeira qualidade', async () => {
    prepararImagem({ width: 4000, height: 3000 }, { 0.8: 1.2 * MB })

    const resultado = await comprimir('file:///foto.heic')

    expect(redimensionamentos).toEqual([1080])
    expect(resultado).toEqual({
      uri: 'file:///q0.8.jpg',
      largura: 1080,
      altura: 810,
      tamanhoBytes: 1.2 * MB,
    })
    expect(salvas).toEqual([{ compress: 0.8, format: SaveFormat.JPEG, width: 1080 }])
  })

  it('não aumenta imagem com 1080 px ou menos de largura', async () => {
    prepararImagem({ width: 800, height: 600 }, { 0.8: 200_000 })

    const resultado = await comprimir('file:///pequena.png')

    expect(redimensionamentos).toEqual([])
    expect(resultado.largura).toBe(800)
  })

  it('tenta 0,8 → 0,6 → 0,4 até ficar abaixo de 5 MB', async () => {
    prepararImagem({ width: 1080, height: 1080 }, { 0.8: 6 * MB, 0.6: 5 * MB + 1, 0.4: 5 * MB })

    const resultado = await comprimir('file:///detalhada.jpg')

    expect(salvas.map(({ compress }) => compress)).toEqual([0.8, 0.6, 0.4])
    expect(resultado).toMatchObject({ uri: 'file:///q0.4.jpg', tamanhoBytes: 5 * MB })
  })

  it('acima de 5 MB mesmo com 0,4 → "Imagem muito grande. Escolha outra imagem."', async () => {
    prepararImagem({ width: 1080, height: 1080 }, { 0.8: 9 * MB, 0.6: 8 * MB, 0.4: 6 * MB })

    const erro = await comprimir('file:///enorme.jpg').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ErroImagem)
    expect(erro).toHaveProperty('message', MENSAGEM_IMAGEM_GRANDE)
    expect(salvas).toHaveLength(3)
  })

  it('imagem não decodificável → "Formato de imagem não suportado."', async () => {
    jest.mocked(ImageManipulator.manipulate).mockImplementation(
      () =>
        ({
          renderAsync: () => Promise.reject(new Error('Could not decode')),
        }) as unknown as ReturnType<typeof ImageManipulator.manipulate>,
    )

    await expect(comprimir('file:///arquivo.pdf')).rejects.toThrow(
      new ErroImagem(MENSAGEM_FORMATO_INVALIDO),
    )
  })
})
