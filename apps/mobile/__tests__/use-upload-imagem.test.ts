import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { toast } from '@/components/ui/toast'
import { ApiErro, api } from '@/infra/api/cliente'
import { pedirPresign } from '@/features/uploads/api'
import { ErroImagem, MENSAGEM_IMAGEM_GRANDE } from '@/features/uploads/comprimir'
import {
  ACAO_ABRIR_CONFIGURACOES,
  MENSAGEM_FALHA_ENVIO,
  MENSAGEM_PERMISSAO_NEGADA,
  useUploadImagem,
  type OrigemImagem,
} from '@/features/uploads/use-upload-imagem'
import {
  IMAGEM_COMPRIMIDA,
  URI_ESCOLHIDA,
  comprimirFalso,
  envios,
  pickerFalso,
  presignNumero,
  prepararUploadFalso,
  respostaPresign,
  ultimoEnvio,
} from '../test-utils/upload-falso'

jest.mock(
  'expo-image-picker',
  () =>
    jest.requireActual<typeof import('../test-utils/upload-falso')>('../test-utils/upload-falso')
      .pickerFalso,
)
jest.mock(
  'expo-file-system/legacy',
  () =>
    jest.requireActual<typeof import('../test-utils/upload-falso')>('../test-utils/upload-falso')
      .arquivosFalso,
)
jest.mock('@/features/uploads/comprimir', () => ({
  ...jest.requireActual<object>('@/features/uploads/comprimir'),
  comprimir: jest.requireActual<typeof import('../test-utils/upload-falso')>(
    '../test-utils/upload-falso',
  ).comprimirFalso,
}))
jest.mock('@/infra/api/cliente', () => ({
  ...jest.requireActual<object>('@/infra/api/api-erro'),
  api: { post: jest.fn() },
}))
jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

const presign = jest.mocked(api.post)

beforeEach(() => {
  prepararUploadFalso()
  presign.mockImplementation(() => Promise.resolve(respostaPresign()))
})

async function selecionarEEsperarPut(
  result: { current: ReturnType<typeof useUploadImagem> },
  origem: OrigemImagem = 'galeria',
) {
  await act(() => {
    void result.current.selecionar(origem)
  })
  await waitFor(() => expect(envios).toHaveLength(1))
}

describe('pedirPresign', () => {
  it('valida com o schema do shared e chama POST /uploads/presign', async () => {
    const pedido = { finalidade: 'PERFIL', contentType: 'image/jpeg', tamanhoBytes: 1000 } as const
    await pedirPresign(pedido)
    expect(presign).toHaveBeenCalledWith('/uploads/presign', pedido)
  })

  it('não chama a API com tamanho acima de 5 MB', () => {
    expect(() =>
      pedirPresign({ finalidade: 'PERFIL', contentType: 'image/jpeg', tamanhoBytes: 5_242_881 }),
    ).toThrow()
    expect(presign).not.toHaveBeenCalled()
  })
})

describe('useUploadImagem', () => {
  it('percorre selecionando → comprimindo → enviando → concluido', async () => {
    let resolverCompressao: (imagem: typeof IMAGEM_COMPRIMIDA) => void = () => undefined
    comprimirFalso.mockReturnValue(new Promise((resolver) => (resolverCompressao = resolver)))
    const terminarCompressao = (imagem: typeof IMAGEM_COMPRIMIDA) => {
      resolverCompressao(imagem)
      return Promise.resolve()
    }
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    expect(result.current.estado).toBe('ocioso')

    await act(() => {
      void result.current.selecionar('galeria')
    })
    await waitFor(() => expect(result.current.estado).toBe('comprimindo'))
    expect(result.current.uriLocal).toBe(URI_ESCOLHIDA)
    expect(comprimirFalso).toHaveBeenCalledWith(URI_ESCOLHIDA)

    await act(() => terminarCompressao(IMAGEM_COMPRIMIDA))
    await waitFor(() => expect(result.current.estado).toBe('enviando'))
    expect(result.current.progresso).toBe(0)

    await act(() => ultimoEnvio().progredir(367_256, 734_512))
    expect(result.current.progresso).toBe(0.5)

    await act(() => ultimoEnvio().concluir(200))
    expect(result.current).toMatchObject({
      estado: 'concluido',
      progresso: 1,
      key: 'usuarios/u1/perfil/obj-1.jpg',
      erro: null,
    })
  })

  it('pede presign com image/jpeg e o tamanho real, e faz PUT sem Authorization', async () => {
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    await selecionarEEsperarPut(result)

    expect(presign).toHaveBeenCalledWith('/uploads/presign', {
      finalidade: 'PERFIL',
      contentType: 'image/jpeg',
      tamanhoBytes: IMAGEM_COMPRIMIDA.tamanhoBytes,
    })
    const envio = ultimoEnvio()
    expect(envio.url).toBe(presignNumero(1).uploadUrl)
    expect(envio.uri).toBe(IMAGEM_COMPRIMIDA.uri)
    expect(envio.opcoes).toEqual({
      httpMethod: 'PUT',
      uploadType: 0,
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '734512' },
    })
    expect(Object.keys(envio.opcoes.headers).map((nome) => nome.toLowerCase())).not.toContain(
      'authorization',
    )
  })

  it.each([
    ['PERFIL', [1, 1]],
    ['NOTICIA', [16, 9]],
    ['BANNER', [16, 9]],
  ] as const)('recorta %s em %j', async (finalidade, aspect) => {
    const { result } = await renderHook(() => useUploadImagem(finalidade))
    await selecionarEEsperarPut(result)

    expect(pickerFalso.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 1,
    })
  })

  it('câmera pede a permissão da câmera e abre a câmera', async () => {
    const { result } = await renderHook(() => useUploadImagem('NOTICIA'))
    await selecionarEEsperarPut(result, 'camera')

    expect(pickerFalso.requestCameraPermissionsAsync).toHaveBeenCalled()
    expect(pickerFalso.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ aspect: [16, 9] }),
    )
    expect(pickerFalso.launchImageLibraryAsync).not.toHaveBeenCalled()
  })

  it('erro de rede no PUT → erro; "Tentar novamente" pede novo presign e reenvia', async () => {
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    await selecionarEEsperarPut(result)

    await act(() => ultimoEnvio().falhar())
    expect(result.current).toMatchObject({
      estado: 'erro',
      erro: MENSAGEM_FALHA_ENVIO,
      podeTentarNovamente: true,
      key: null,
    })

    await act(() => {
      void result.current.tentarNovamente()
    })
    await waitFor(() => expect(envios).toHaveLength(2))
    expect(presign).toHaveBeenCalledTimes(2)
    expect(comprimirFalso).toHaveBeenCalledTimes(1)
    expect(ultimoEnvio().url).toBe(presignNumero(2).uploadUrl)

    await act(() => ultimoEnvio().concluir())
    expect(result.current).toMatchObject({
      estado: 'concluido',
      key: 'usuarios/u1/perfil/obj-2.jpg',
    })
  })

  it('PUT recusado pelo R2 (403) → erro', async () => {
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    await selecionarEEsperarPut(result)

    await act(() => ultimoEnvio().concluir(403))
    expect(result.current).toMatchObject({ estado: 'erro', erro: MENSAGEM_FALHA_ENVIO })
  })

  it('erro da API no presign mostra a mensagem da API', async () => {
    presign.mockRejectedValue(
      new ApiErro({ status: 429, code: 'RATE_LIMITED', message: 'Muitas tentativas.' }),
    )
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    await act(() => result.current.selecionar('galeria'))

    expect(result.current).toMatchObject({ estado: 'erro', erro: 'Muitas tentativas.' })
    expect(envios).toHaveLength(0)
  })

  it('imagem grande demais → erro sem chamar a API e sem "Tentar novamente"', async () => {
    comprimirFalso.mockRejectedValue(new ErroImagem(MENSAGEM_IMAGEM_GRANDE))
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    await act(() => result.current.selecionar('galeria'))

    expect(result.current).toMatchObject({
      estado: 'erro',
      erro: MENSAGEM_IMAGEM_GRANDE,
      podeTentarNovamente: false,
    })
    expect(presign).not.toHaveBeenCalled()
  })

  it('permissão negada → toast com atalho para as configurações, sem abrir a galeria', async () => {
    pickerFalso.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false })
    const abrirConfiguracoes = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))

    await act(() => result.current.selecionar('galeria'))

    expect(result.current.estado).toBe('ocioso')
    expect(pickerFalso.launchImageLibraryAsync).not.toHaveBeenCalled()
    expect(toast.erro).toHaveBeenCalledWith(MENSAGEM_PERMISSAO_NEGADA, {
      acao: ACAO_ABRIR_CONFIGURACOES,
      aoTocar: expect.any(Function) as () => void,
    })
    jest.mocked(toast.erro).mock.calls[0]?.[1]?.aoTocar()
    expect(abrirConfiguracoes).toHaveBeenCalled()
  })

  it('seleção cancelada volta ao estado anterior', async () => {
    pickerFalso.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null })
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))

    await act(() => result.current.selecionar('galeria'))

    expect(result.current.estado).toBe('ocioso')
    expect(comprimirFalso).not.toHaveBeenCalled()
  })

  it('limpar durante o envio cancela o PUT e volta a ocioso', async () => {
    const { result } = await renderHook(() => useUploadImagem('PERFIL'))
    await selecionarEEsperarPut(result)

    await act(() => result.current.limpar())
    expect(ultimoEnvio().cancelAsync).toHaveBeenCalled()
    expect(result.current).toMatchObject({ estado: 'ocioso', uriLocal: null, key: null })

    await act(() => ultimoEnvio().concluir())
    expect(result.current.estado).toBe('ocioso')
  })
})
