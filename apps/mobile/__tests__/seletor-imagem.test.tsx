import NetInfo from '@react-native-community/netinfo'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Linking, View } from 'react-native'
import { MENSAGEM_APENAS_ONLINE, MENSAGEM_PREPARANDO, SeletorImagem } from '@/components/imagem'
import { Botao, Texto } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { api } from '@/infra/api/cliente'
import { MENSAGEM_IMAGEM_GRANDE, ErroImagem } from '@/features/uploads/comprimir'
import {
  ACAO_ABRIR_CONFIGURACOES,
  MENSAGEM_FALHA_ENVIO,
  MENSAGEM_PERMISSAO_NEGADA,
} from '@/features/uploads/use-upload-imagem'
import { configurarRede } from '@/infra/rede/online'
import { renderizar } from '../test-utils/renderizar'
import {
  URI_ESCOLHIDA,
  comprimirFalso,
  envios,
  pickerFalso,
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
      .arquivosFalsos,
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

const URL_ATUAL = 'https://img.exemplo.com/usuarios/u1/perfil/atual.jpg'
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }
const emitirRede = (conectado: boolean) =>
  act(() => netInfo.__emitir({ isConnected: conectado, isInternetReachable: conectado }))

const imagemExibida = () => screen.getByTestId('imagem').props as { source: { uri: string } }

beforeAll(() => configurarRede())

beforeEach(async () => {
  prepararUploadFalso()
  jest.mocked(api.post).mockImplementation(() => Promise.resolve(respostaPresign()))
  await emitirRede(true)
})

async function escolherDaGaleria() {
  await fireEvent.press(screen.getByRole('button', { name: 'Galeria' }))
}

describe('SeletorImagem', () => {
  it('mostra a imagem atual', async () => {
    await renderizar(
      <SeletorImagem
        finalidade="PERFIL"
        formato="circulo"
        valorAtualUrl={URL_ATUAL}
        onChange={jest.fn()}
      />,
    )
    expect(imagemExibida().source.uri).toBe(URL_ATUAL)
  })

  it('comprimindo → pré-visualização local e "Preparando imagem…"', async () => {
    comprimirFalso.mockReturnValue(new Promise(() => undefined))
    await renderizar(
      <SeletorImagem
        finalidade="PERFIL"
        formato="circulo"
        valorAtualUrl={URL_ATUAL}
        onChange={jest.fn()}
      />,
    )

    await escolherDaGaleria()

    expect(await screen.findByText(MENSAGEM_PREPARANDO)).toBeOnTheScreen()
    expect(imagemExibida().source.uri).toBe(URI_ESCOLHIDA)
    expect(screen.getByRole('button', { name: 'Galeria' })).toBeDisabled()
  })

  it('enviando → barra de progresso; concluído → sem sobreposição e onChange(key)', async () => {
    const onChange = jest.fn()
    await renderizar(<SeletorImagem finalidade="NOTICIA" formato="retangulo" onChange={onChange} />)

    await escolherDaGaleria()
    await waitFor(() => expect(envios).toHaveLength(1))
    await act(() => ultimoEnvio().progredir(40, 100))

    const barra = screen.getByRole('progressbar', { name: 'Enviando imagem' })
    expect(barra).toHaveAccessibilityValue({ min: 0, max: 100, now: 40 })

    await act(() => ultimoEnvio().concluir())

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(MENSAGEM_PREPARANDO)).toBeNull()
    expect(onChange).toHaveBeenCalledWith('usuarios/u1/perfil/obj-1.jpg')
    expect(imagemExibida().source.uri).toBe(URI_ESCOLHIDA)
  })

  it('onMudarImagem recebe a imagem atual, a escolhida e null ao remover', async () => {
    const onMudarImagem = jest.fn()
    await renderizar(
      <SeletorImagem
        finalidade="NOTICIA"
        formato="retangulo"
        valorAtualUrl={URL_ATUAL}
        onChange={jest.fn()}
        onMudarImagem={onMudarImagem}
      />,
    )
    expect(onMudarImagem).toHaveBeenLastCalledWith(URL_ATUAL)

    await escolherDaGaleria()
    await waitFor(() => expect(onMudarImagem).toHaveBeenLastCalledWith(URI_ESCOLHIDA))
    await waitFor(() => expect(envios).toHaveLength(1))
    await act(() => ultimoEnvio().concluir())

    await fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    expect(onMudarImagem).toHaveBeenLastCalledWith(null)
  })

  it('mensagemImagemInvalida substitui o erro de tamanho', async () => {
    comprimirFalso.mockRejectedValue(new ErroImagem(MENSAGEM_IMAGEM_GRANDE))
    await renderizar(
      <SeletorImagem
        finalidade="NOTICIA"
        formato="retangulo"
        mensagemImagemInvalida="Capa inválida"
        onChange={jest.fn()}
      />,
    )
    await escolherDaGaleria()

    expect(await screen.findByText('Capa inválida')).toBeOnTheScreen()
    expect(screen.queryByText(MENSAGEM_IMAGEM_GRANDE)).toBeNull()
  })

  it('erro no envio → mensagem e "Tentar novamente", que pede novo presign', async () => {
    const onChange = jest.fn()
    await renderizar(<SeletorImagem finalidade="PERFIL" formato="circulo" onChange={onChange} />)

    await escolherDaGaleria()
    await waitFor(() => expect(envios).toHaveLength(1))
    await act(() => ultimoEnvio().falhar())

    expect(screen.getByText(MENSAGEM_FALHA_ENVIO)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(envios).toHaveLength(2))
    expect(api.post).toHaveBeenCalledTimes(2)

    await act(() => ultimoEnvio().concluir())
    expect(screen.queryByText(MENSAGEM_FALHA_ENVIO)).toBeNull()
    expect(onChange).toHaveBeenCalledWith('usuarios/u1/perfil/obj-2.jpg')
  })

  it('imagem grande demais mostra o erro sem "Tentar novamente"', async () => {
    comprimirFalso.mockRejectedValue(new ErroImagem(MENSAGEM_IMAGEM_GRANDE))
    await renderizar(<SeletorImagem finalidade="PERFIL" formato="circulo" onChange={jest.fn()} />)

    await escolherDaGaleria()

    expect(await screen.findByText(MENSAGEM_IMAGEM_GRANDE)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('"Remover" limpa a imagem e chama onChange(null)', async () => {
    const onChange = jest.fn()
    await renderizar(
      <SeletorImagem
        finalidade="PERFIL"
        formato="circulo"
        valorAtualUrl={URL_ATUAL}
        nome="Ana Souza"
        onChange={onChange}
      />,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Remover' }))

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByTestId('imagem')).toBeNull()
    expect(screen.getByText('AS')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()
  })

  it('sem imagem ou com podeRemover=false não mostra "Remover"', async () => {
    const { rerender } = await renderizar(
      <SeletorImagem finalidade="NOTICIA" formato="retangulo" onChange={jest.fn()} />,
    )
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()

    await rerender(
      <SeletorImagem
        finalidade="NOTICIA"
        formato="retangulo"
        valorAtualUrl={URL_ATUAL}
        podeRemover={false}
        onChange={jest.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()
  })

  it('offline → desabilitado com "Disponível apenas online"', async () => {
    await renderizar(
      <SeletorImagem
        finalidade="PERFIL"
        formato="circulo"
        valorAtualUrl={URL_ATUAL}
        onChange={jest.fn()}
      />,
    )

    await emitirRede(false)

    expect(screen.getByText(MENSAGEM_APENAS_ONLINE)).toBeOnTheScreen()
    for (const nome of ['Galeria', 'Câmera', 'Remover']) {
      expect(screen.getByRole('button', { name: nome })).toBeDisabled()
    }
    await escolherDaGaleria()
    expect(pickerFalso.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled()

    await emitirRede(true)
    expect(screen.queryByText(MENSAGEM_APENAS_ONLINE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Galeria' })).toBeEnabled()
  })

  it('desabilitado não abre a seleção', async () => {
    await renderizar(
      <SeletorImagem finalidade="PERFIL" formato="circulo" desabilitado onChange={jest.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Câmera' })).toBeDisabled()
  })

  it('permissão negada mostra a orientação com atalho para as configurações', async () => {
    pickerFalso.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false })
    const abrirConfiguracoes = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    await renderizar(<SeletorImagem finalidade="PERFIL" formato="circulo" onChange={jest.fn()} />)

    await escolherDaGaleria()

    await waitFor(() =>
      expect(toast.erro).toHaveBeenCalledWith(MENSAGEM_PERMISSAO_NEGADA, {
        rotulo: ACAO_ABRIR_CONFIGURACOES,
        aoTocar: expect.any(Function) as () => void,
      }),
    )
    jest.mocked(toast.erro).mock.calls[0]?.[1]?.aoTocar()
    expect(abrirConfiguracoes).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Galeria' })).toBeEnabled()
  })
})

type DadosPerfil = { fotoKey: string | null }

function FormularioPerfil({ aoSalvar }: { aoSalvar: (dados: DadosPerfil) => void }) {
  const form = useForm<DadosPerfil>({ defaultValues: { fotoKey: null } })
  const [enviando, setEnviando] = useState(false)
  return (
    <View>
      <Controller
        control={form.control}
        name="fotoKey"
        render={({ field }) => (
          <SeletorImagem
            finalidade="PERFIL"
            formato="circulo"
            valorAtualUrl={URL_ATUAL}
            onChange={field.onChange}
            onMudarEnviando={setEnviando}
          />
        )}
      />
      <Texto>{enviando ? 'enviando' : 'parado'}</Texto>
      <Botao
        titulo="Salvar"
        disabled={enviando}
        onPress={() => void form.handleSubmit(aoSalvar)()}
      />
    </View>
  )
}

describe('SeletorImagem com React Hook Form', () => {
  it('o valor do campo é a key e o salvar fica desabilitado durante o envio', async () => {
    const aoSalvar = jest.fn<void, [DadosPerfil]>()
    await renderizar(<FormularioPerfil aoSalvar={aoSalvar} />)

    await escolherDaGaleria()
    await waitFor(() => expect(envios).toHaveLength(1))
    expect(screen.getByText('enviando')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()

    await act(() => ultimoEnvio().concluir())
    expect(screen.getByText('parado')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(aoSalvar.mock.calls[0]?.[0]).toEqual({ fotoKey: 'usuarios/u1/perfil/obj-1.jpg' })
  })
})
