import type { ImagemComprimida } from '@/features/uploads/comprimir'

type Progresso = (dados: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void

export type EnvioFalso = {
  url: string
  uri: string
  opcoes: { httpMethod: string; uploadType: number; headers: Record<string, string> }
  progredir: (enviados: number, total: number) => Promise<void>
  concluir: (status?: number) => Promise<void>
  falhar: (erro?: Error) => Promise<void>
  cancelAsync: jest.Mock
}

export const pickerFalso = {
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}

export const envios: EnvioFalso[] = []

export const arquivosFalso = {
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  getInfoAsync: jest.fn(),
  createUploadTask: jest.fn(
    (url: string, uri: string, opcoes: EnvioFalso['opcoes'], aoProgredir: Progresso) => {
      let resolver: (valor: { status: number }) => void = () => undefined
      let rejeitar: (erro: Error) => void = () => undefined
      const resposta = new Promise<{ status: number }>((res, rej) => {
        resolver = res
        rejeitar = rej
      })
      const envio: EnvioFalso = {
        url,
        uri,
        opcoes,
        progredir: (enviados, total) => {
          aoProgredir({ totalBytesSent: enviados, totalBytesExpectedToSend: total })
          return Promise.resolve()
        },
        concluir: (status = 200) => {
          resolver({ status })
          return Promise.resolve()
        },
        falhar: (erro = new Error('Network request failed')) => {
          rejeitar(erro)
          return Promise.resolve()
        },
        cancelAsync: jest.fn(() => Promise.resolve()),
      }
      envios.push(envio)
      return { uploadAsync: () => resposta, cancelAsync: envio.cancelAsync }
    },
  ),
}

export const comprimirFalso = jest.fn<Promise<ImagemComprimida>, [string]>()

export const IMAGEM_COMPRIMIDA: ImagemComprimida = {
  uri: 'file:///cache/comprimida.jpg',
  largura: 1080,
  altura: 1080,
  tamanhoBytes: 734_512,
}

export const URI_ESCOLHIDA = 'file:///cache/escolhida.jpg'

let presigns = 0

/** O n-ésimo presign do teste: cada pedido devolve URL e `key` novas. */
export function presignNumero(n: number) {
  return {
    uploadUrl: `https://conta.r2.cloudflarestorage.com/bucket/obj-${n}.jpg?X-Amz-Signature=${n}`,
    key: `usuarios/u1/perfil/obj-${n}.jpg`,
    publicUrl: `https://img.exemplo.com/usuarios/u1/perfil/obj-${n}.jpg`,
    expiresAt: '2026-10-04T12:05:00.000Z',
  }
}

export function respostaPresign() {
  presigns += 1
  return presignNumero(presigns)
}

/** Caminho feliz: permissão concedida, imagem escolhida e comprimida; o PUT fica pendente. */
export function prepararUploadFalso() {
  envios.length = 0
  presigns = 0
  jest.clearAllMocks()
  pickerFalso.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true })
  pickerFalso.requestCameraPermissionsAsync.mockResolvedValue({ granted: true })
  const escolhida = { canceled: false, assets: [{ uri: URI_ESCOLHIDA, width: 4000, height: 3000 }] }
  pickerFalso.launchImageLibraryAsync.mockResolvedValue(escolhida)
  pickerFalso.launchCameraAsync.mockResolvedValue(escolhida)
  comprimirFalso.mockResolvedValue(IMAGEM_COMPRIMIDA)
}

export function ultimoEnvio(): EnvioFalso {
  const envio = envios[envios.length - 1]
  if (!envio) throw new Error('nenhum PUT foi iniciado')
  return envio
}
