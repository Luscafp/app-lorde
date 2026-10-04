import { MENSAGEM_RECUPERACAO_ENVIADA } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent } from '@testing-library/react-native'
import { renderRouter, screen } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import * as rotaPublica from '../app/(publico)/_layout'
import Cadastro from '../app/(publico)/cadastro'
import Login from '../app/(publico)/login'
import InformarCodigo from '../app/(publico)/recuperar-senha/codigo'
import InformarEmail from '../app/(publico)/recuperar-senha/index'
import NovaSenha from '../app/(publico)/recuperar-senha/nova-senha'
import { toast } from '@/components/ui/toast'
import { MENSAGEM_SENHA_REDEFINIDA, useRecuperacaoStore } from '@/features/recuperacao-senha'
import { api, ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

jest.mock('@/infra/api/cliente', () => ({
  ...jest.requireActual<object>('@/infra/api/cliente'),
  api: { post: jest.fn() },
}))

const post = jest.mocked(api.post)
const EMAIL = 'ana@ex.com'
const LIMITE = 'Limite de 3 envios por hora atingido. Tente novamente em 42 min.'

const codigoInvalido = () =>
  new ApiErro({ status: 400, code: 'CODIGO_INVALIDO', message: 'Código inválido ou expirado.' })

let cliente: QueryClient

function LayoutRaiz() {
  return (
    <QueryClientProvider client={cliente}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}

const rotas = {
  _layout: LayoutRaiz,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': Login,
  '(publico)/cadastro': Cadastro,
  '(publico)/recuperar-senha/index': InformarEmail,
  '(publico)/recuperar-senha/codigo': InformarCodigo,
  '(publico)/recuperar-senha/nova-senha': NovaSenha,
}

async function abrir(initialUrl: string) {
  const rota = renderRouter(rotas, { initialUrl })
  await rota
  await screen.findByRole('header')
  return () => rota.getPathname()
}

const caixa = (posicao: number) => screen.getByLabelText(`Dígito ${posicao} de 6`)
const valores = () =>
  [1, 2, 3, 4, 5, 6].map((posicao) => (caixa(posicao).props as { value: string }).value)

async function digitarCodigo(codigo: string) {
  await fireEvent.changeText(caixa(1), codigo)
}

function comCodigoEnviado(dados: { codigo?: string; enviadoEm?: number } = {}) {
  useRecuperacaoStore.setState({
    email: EMAIL,
    codigo: dados.codigo ?? '',
    enviadoEm: dados.enviadoEm ?? Date.now(),
    emailLogin: null,
  })
}

beforeEach(() => {
  cliente = criarQueryClient()
  post.mockReset()
  jest.mocked(toast.erro).mockClear()
  jest.mocked(toast.sucesso).mockClear()
  useRecuperacaoStore.setState({ email: '', codigo: '', enviadoEm: null, emailLogin: null })
  onlineManager.setOnline(true)
})

afterEach(() => cliente.clear())

describe('login', () => {
  it('"Esqueci minha senha" abre a tela de e-mail', async () => {
    const caminho = await abrir('/login')

    await fireEvent.press(screen.getByText('Esqueci minha senha'))

    expect(await screen.findByRole('header', { name: 'Recuperar senha' })).toBeOnTheScreen()
    expect(caminho()).toBe('/recuperar-senha')
  })
})

describe('tela de e-mail', () => {
  it('envia o e-mail normalizado e vai para a tela do código com a mensagem neutra', async () => {
    post.mockResolvedValueOnce({ message: MENSAGEM_RECUPERACAO_ENVIADA })
    const caminho = await abrir('/recuperar-senha')

    await fireEvent.changeText(screen.getByLabelText('E-mail'), ' ANA@ex.com ')
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))

    expect(await screen.findByText(MENSAGEM_RECUPERACAO_ENVIADA)).toBeOnTheScreen()
    expect(post).toHaveBeenCalledWith('/auth/senha/esqueci', { email: EMAIL })
    expect(caminho()).toBe('/recuperar-senha/codigo')
    expect(useRecuperacaoStore.getState()).toMatchObject({ email: EMAIL, codigo: '' })
  })

  it('vem preenchida com o e-mail do store (iniciado pelo login)', async () => {
    useRecuperacaoStore.getState().iniciar(EMAIL)
    await abrir('/recuperar-senha')

    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue(EMAIL)
  })

  it('429 mostra a mensagem de limite e fica na tela', async () => {
    post.mockRejectedValueOnce(new ApiErro({ status: 429, code: 'RATE_LIMITED', message: LIMITE }))
    const caminho = await abrir('/recuperar-senha')

    await fireEvent.changeText(screen.getByLabelText('E-mail'), EMAIL)
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))

    await screen.findByRole('button', { name: 'Enviar código' })
    expect(toast.erro).toHaveBeenCalledWith(LIMITE)
    expect(caminho()).toBe('/recuperar-senha')
  })

  it('offline: faixa de modo offline, botão desabilitado e nenhuma chamada à API', async () => {
    await abrir('/recuperar-senha')
    await act(() => onlineManager.setOnline(false))

    await fireEvent.changeText(screen.getByLabelText('E-mail'), EMAIL)
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))

    expect(screen.getByText('Modo offline')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('tela do código', () => {
  it('sem e-mail no fluxo volta para a tela de e-mail', async () => {
    const caminho = await abrir('/recuperar-senha/codigo')
    expect(caminho()).toBe('/recuperar-senha')
  })

  it('mostra o contador de expiração e só habilita Verificar com 6 dígitos', async () => {
    comCodigoEnviado({ enviadoEm: Date.now() - 60_000 })
    await abrir('/recuperar-senha/codigo')

    expect(screen.getByText(/O código expira em 14:0\d/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled()
    await digitarCodigo('04821')
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled()
    await fireEvent.changeText(caixa(6), '3')
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeEnabled()
  })

  it('código expirado no relógio do app avisa para pedir outro', async () => {
    comCodigoEnviado({ enviadoEm: Date.now() - 16 * 60_000 })
    await abrir('/recuperar-senha/codigo')

    expect(screen.getByText('O código expirou. Peça um novo código.')).toBeOnTheScreen()
  })

  it('código válido vai para a nova senha sem colocá-lo na URL', async () => {
    post.mockResolvedValueOnce({ valido: true })
    comCodigoEnviado()
    const caminho = await abrir('/recuperar-senha/codigo')

    await digitarCodigo('048213')
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByRole('header', { name: 'Nova senha' })).toBeOnTheScreen()
    expect(post).toHaveBeenCalledWith('/auth/senha/verificar-codigo', {
      email: EMAIL,
      codigo: '048213',
    })
    expect(caminho()).toBe('/recuperar-senha/nova-senha')
    expect(caminho()).not.toContain('048213')
  })

  it('CODIGO_INVALIDO limpa as caixas e mostra a mensagem', async () => {
    post.mockRejectedValueOnce(codigoInvalido())
    comCodigoEnviado()
    await abrir('/recuperar-senha/codigo')

    await digitarCodigo('048213')
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText('Código inválido ou expirado.')).toBeOnTheScreen()
    expect(toast.erro).toHaveBeenCalledWith('Código inválido ou expirado.')
    expect(valores()).toEqual(['', '', '', '', '', ''])
  })

  it('"Reenviar código" fica desabilitado nos primeiros 60 s', async () => {
    comCodigoEnviado({ enviadoEm: Date.now() - 10_000 })
    await abrir('/recuperar-senha/codigo')

    expect(screen.getByRole('button', { name: /Reenviar código em \d+ s/ })).toBeDisabled()
  })

  it('reenviar depois de 60 s pede outro código e reinicia a espera', async () => {
    post.mockResolvedValueOnce({ message: MENSAGEM_RECUPERACAO_ENVIADA })
    comCodigoEnviado({ enviadoEm: Date.now() - 61_000, codigo: '123' })
    await abrir('/recuperar-senha/codigo')

    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar código' }))

    expect(await screen.findByRole('button', { name: /Reenviar código em \d+ s/ })).toBeDisabled()
    expect(post).toHaveBeenCalledWith('/auth/senha/esqueci', { email: EMAIL })
    expect(toast.sucesso).toHaveBeenCalledWith('Enviamos um novo código.')
    expect(useRecuperacaoStore.getState().codigo).toBe('')
  })

  it('429 no reenvio mostra a mensagem de limite', async () => {
    post.mockRejectedValueOnce(new ApiErro({ status: 429, code: 'RATE_LIMITED', message: LIMITE }))
    comCodigoEnviado({ enviadoEm: Date.now() - 61_000 })
    await abrir('/recuperar-senha/codigo')

    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar código' }))

    await screen.findByRole('button', { name: 'Reenviar código' })
    expect(toast.erro).toHaveBeenCalledWith(LIMITE)
  })

  it('offline não chama a API', async () => {
    comCodigoEnviado({ codigo: '048213' })
    await abrir('/recuperar-senha/codigo')
    await act(() => onlineManager.setOnline(false))

    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))

    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('tela de nova senha', () => {
  async function abrirPeloCodigo() {
    post.mockResolvedValueOnce({ valido: true })
    comCodigoEnviado()
    const caminho = await abrir('/recuperar-senha/codigo')
    await digitarCodigo('048213')
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))
    await screen.findByRole('header', { name: 'Nova senha' })
    return caminho
  }

  async function preencherSenha(senha = 'novaSenha9', confirmacao = senha) {
    await fireEvent.changeText(screen.getByLabelText('Nova senha'), senha)
    await fireEvent.changeText(screen.getByLabelText('Confirmar nova senha'), confirmacao)
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }))
  }

  it('confirmação diferente não envia', async () => {
    await abrirPeloCodigo()

    await preencherSenha('novaSenha9', 'novaSenha8')

    expect(await screen.findByText('As senhas não conferem.')).toBeOnTheScreen()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('sucesso: toast, volta ao login e deixa o e-mail para preencher o login', async () => {
    const caminho = await abrirPeloCodigo()
    post.mockResolvedValueOnce(undefined)

    await preencherSenha()

    expect(await screen.findByText('Esqueci minha senha')).toBeOnTheScreen()
    expect(post).toHaveBeenLastCalledWith('/auth/senha/redefinir', {
      email: EMAIL,
      codigo: '048213',
      novaSenha: 'novaSenha9',
    })
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_SENHA_REDEFINIDA)
    expect(caminho()).toBe('/login')
    expect(useRecuperacaoStore.getState().consumirEmailLogin()).toBe(EMAIL)
    expect(useRecuperacaoStore.getState()).toMatchObject({ codigo: '', emailLogin: null })
  })

  it('CODIGO_INVALIDO volta para a tela do código com as caixas vazias', async () => {
    const caminho = await abrirPeloCodigo()
    post.mockRejectedValueOnce(codigoInvalido())

    await preencherSenha()

    expect(await screen.findByRole('header', { name: 'Digite o código' })).toBeOnTheScreen()
    expect(caminho()).toBe('/recuperar-senha/codigo')
    expect(toast.erro).toHaveBeenCalledWith('Código inválido ou expirado.')
    expect(valores()).toEqual(['', '', '', '', '', ''])
  })

  it('erro de validação da API aparece no campo', async () => {
    await abrirPeloCodigo()
    post.mockRejectedValueOnce(
      new ApiErro({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: [{ field: 'novaSenha', message: 'Senha recusada pela API.' }],
      }),
    )

    await preencherSenha()

    expect(await screen.findByText('Senha recusada pela API.')).toBeOnTheScreen()
  })

  it('offline: faixa de modo offline, botão desabilitado e nenhuma chamada à API', async () => {
    await abrirPeloCodigo()
    await act(() => onlineManager.setOnline(false))

    await preencherSenha()

    expect(screen.getByText('Modo offline')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled()
    expect(post).toHaveBeenCalledTimes(1)
  })
})
