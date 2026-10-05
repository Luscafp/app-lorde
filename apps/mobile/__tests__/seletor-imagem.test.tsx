import NetInfo from '@react-native-community/netinfo'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Linking, View, type AlertButton } from 'react-native'
import {
  MENSAGEM_APENAS_ONLINE,
  MENSAGEM_PREPARANDO,
  OPCAO_CAMERA,
  OPCAO_GALERIA,
  OPCAO_REMOVER,
  ROTULO_ALTERAR_IMAGEM,
  SeletorImagem,
} from '@/components/imagem'
import { Botao, Texto } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { api } from '@/infra/api/cliente'
import { MENSAGEM_IMAGEM_INVALIDA, ErroImagem } from '@/features/uploads/comprimir'
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

const avatar = () => screen.getByRole('button', { name: ROTULO_ALTERAR_IMAGEM })

async function escolherNoMenu(opcao: string) {
  await fireEvent.press(avatar())
  await fireEvent.press(screen.getByRole('button', { name: opcao }))
}

async function escolherDaGaleria() {
  await escolherNoMenu(OPCAO_GALERIA)
}

function responderConfirmacao(estilo: AlertButton['style']) {
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_titulo, _mensagem, botoes) =>
      botoes?.find((botao) => botao.style === estilo)?.onPress?.(),
    )
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
    expect(avatar()).toBeDisabled()
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
    comprimirFalso.mockRejectedValue(new ErroImagem(MENSAGEM_IMAGEM_INVALIDA))
    await renderizar(<SeletorImagem finalidade="PERFIL" formato="circulo" onChange={jest.fn()} />)

    await escolherDaGaleria()

    expect(await screen.findByText(MENSAGEM_IMAGEM_INVALIDA)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('tocar no avatar abre o menu com galeria, câmera, remover e cancelar', async () => {
    await renderizar(
      <SeletorImagem
        finalidade="PERFIL"
        formato="circulo"
        valorAtualUrl={URL_ATUAL}
        onChange={jest.fn()}
      />,
    )

    await fireEvent.press(avatar())

    for (const nome of [OPCAO_GALERIA, OPCAO_CAMERA, OPCAO_REMOVER, 'Cancelar']) {
      expect(screen.getByRole('button', { name: nome })).toBeOnTheScreen()
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('button', { name: OPCAO_GALERIA })).toBeNull()
  })

  it('"Remover foto" pede confirmação; cancelar mantém a imagem', async () => {
    responderConfirmacao('cancel')
    const onChange = jest.fn()
    await renderizar(
      <SeletorImagem
        finalidade="PERFIL"
        formato="circulo"
        valorAtualUrl={URL_ATUAL}
        onChange={onChange}
      />,
    )

    await escolherNoMenu(OPCAO_REMOVER)

    expect(Alert.alert).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(imagemExibida().source.uri).toBe(URL_ATUAL)
  })

  it('"Remover foto" confirmado limpa a imagem e chama onChange(null)', async () => {
    responderConfirmacao('destructive')
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

    await escolherNoMenu(OPCAO_REMOVER)

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByTestId('imagem')).toBeNull()
    expect(screen.getByText('AS')).toBeOnTheScreen()
    await fireEvent.press(avatar())
    expect(screen.queryByRole('button', { name: OPCAO_REMOVER })).toBeNull()
  })

  it('sem imagem ou com podeRemover=false não mostra "Remover foto"', async () => {
    const { rerender } = await renderizar(
      <SeletorImagem finalidade="NOTICIA" formato="retangulo" onChange={jest.fn()} />,
    )
    await fireEvent.press(avatar())
    expect(screen.queryByRole('button', { name: OPCAO_REMOVER })).toBeNull()

    await rerender(
      <SeletorImagem
        finalidade="NOTICIA"
        formato="retangulo"
        valorAtualUrl={URL_ATUAL}
        podeRemover={false}
        onChange={jest.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: OPCAO_REMOVER })).toBeNull()
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
    expect(avatar()).toBeDisabled()
    await fireEvent.press(avatar())
    expect(screen.queryByRole('button', { name: OPCAO_GALERIA })).toBeNull()

    await emitirRede(true)
    expect(screen.queryByText(MENSAGEM_APENAS_ONLINE)).toBeNull()
    expect(avatar()).toBeEnabled()
  })

  it('desabilitado não abre a seleção', async () => {
    await renderizar(
      <SeletorImagem finalidade="PERFIL" formato="circulo" desabilitado onChange={jest.fn()} />,
    )
    expect(avatar()).toBeDisabled()
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
    expect(avatar()).toBeEnabled()
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
