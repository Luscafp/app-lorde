import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { Papel, TERMOS_VERSAO, type AtleticaPublica, type RespostaSessao } from '@atletica/shared'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderRouter, screen } from 'expo-router/testing-library'
import * as rotaApp from '../app/(app)/_layout'
import LayoutAbas from '../app/(app)/(abas)/_layout'
import Inicio from '../app/(app)/(abas)/index'
import * as rotaPublica from '../app/(publico)/_layout'
import Cadastro from '../app/(publico)/cadastro'
import Login from '../app/(publico)/login'
import PaginaNaoEncontrada from '../app/+not-found'
import LayoutRaiz from '../app/_layout'
import Privacidade from '../app/privacidade'
import Termos from '../app/termos'
import { toast } from '@/components/ui/toast'
import { CHAVE_CACHE_ATLETICA } from '@/features/atletica/api'
import { queryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { CHAVE_DADOS_SESSAO, CHAVE_REFRESH_TOKEN, useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

const rotas = {
  _layout: LayoutRaiz,
  '+not-found': PaginaNaoEncontrada,
  termos: Termos,
  privacidade: Privacidade,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': Login,
  '(publico)/cadastro': Cadastro,
  '(app)/_layout': rotaApp,
  '(app)/(abas)/_layout': LayoutAbas,
  '(app)/(abas)/index': Inicio,
}

const atletica: AtleticaPublica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Teste',
  sigla: 'AT',
  curso: null,
  logoUrl: null,
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: 'diretoria@exemplo.com',
  contatoInstagram: null,
  contatoWhatsapp: null,
}

const sessao: RespostaSessao = {
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiraEm: '2026-10-04T12:15:00.000Z',
  usuario: {
    id: '0b0f5c0e-6a43-4c55-9d3a-0d7f8d6c4f11',
    nome: 'Ana',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    papel: Papel.ATLETA,
    atleticaId: atletica.id,
  },
}

type Resposta = { status: number; corpo?: unknown; cabecalhos?: Record<string, string> }

const respostasAuth = new Map<string, Resposta>()
const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()

function responder({ status, corpo, cabecalhos = {} }: Resposta): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nome: string) => cabecalhos[nome.toLowerCase()] ?? null },
    text: () => Promise.resolve(corpo === undefined ? '' : JSON.stringify(corpo)),
  } as unknown as Response
}

const erroApi = (
  status: number,
  code: string,
  message: string,
  details: { field: string; message: string }[] = [],
  extras: Partial<Resposta> = {},
) => ({
  status,
  corpo: { statusCode: status, code, message, details },
  ...extras,
})

function chamadasPara(caminho: string) {
  return fetchMock.mock.calls
    .filter(([url]) => url.endsWith(caminho))
    .map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>)
}

async function abrir(initialUrl: string) {
  const rota = renderRouter(rotas, { initialUrl })
  await rota
  await screen.findByRole('header')
  return () => rota.getPathname()
}

async function preencher(rotulo: string, valor: string) {
  await fireEvent.changeText(screen.getByLabelText(rotulo), valor)
}

async function preencherCadastro(dados: Partial<Record<string, string>> = {}) {
  const valores = {
    Nome: 'Ana Souza',
    'E-mail': 'ana@exemplo.com',
    Senha: 'senha2026',
    'Confirmar senha': 'senha2026',
    ...dados,
  }
  for (const [rotulo, valor] of Object.entries(valores)) await preencher(rotulo, valor)
}

const botao = (nome: string) => screen.getByRole('button', { name: nome })

beforeEach(async () => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url) => {
    if (url.endsWith('/atletica'))
      return Promise.resolve(responder({ status: 200, corpo: atletica }))
    const resposta = [...respostasAuth].find(([caminho]) => url.endsWith(caminho))?.[1]
    if (resposta) return Promise.resolve(responder(resposta))
    return Promise.reject(new TypeError('Network request failed'))
  })
  global.fetch = fetchMock as unknown as typeof fetch
  respostasAuth.clear()
  itensSeguros.clear()
  queryClient.clear()
  jest.mocked(toast.erro).mockClear()
  jest.mocked(toast.sucesso).mockClear()
  await AsyncStorage.clear()
  await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
  netInfo.__emitir({ isConnected: true, isInternetReachable: true })
  useSessao.setState({ status: 'carregando', usuario: null, accessToken: null, refreshToken: null })
})

describe('login', () => {
  it('mostra o nome da atlética e, com sucesso, inicia a sessão com o contrato completo e abre o Início', async () => {
    respostasAuth.set('/auth/login', { status: 200, corpo: sessao })
    const caminho = await abrir('/login')
    expect(screen.getByText('Atlética Teste')).toBeOnTheScreen()

    await preencher('E-mail', '  Ana@Exemplo.com ')
    await preencher('Senha', 'senha2026')
    await fireEvent.press(botao('Entrar'))

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(caminho()).toBe('/')
    expect(chamadasPara('/auth/login')).toEqual([{ email: 'ana@exemplo.com', senha: 'senha2026' }])
    const { accessToken, refreshToken, accessTokenExpiraEm, usuario } = useSessao.getState()
    expect({ accessToken, refreshToken, accessTokenExpiraEm, usuario }).toEqual(sessao)
  })

  it('CREDENCIAIS_INVALIDAS mostra a caixa de erro sem toast', async () => {
    respostasAuth.set(
      '/auth/login',
      erroApi(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.'),
    )
    await abrir('/login')

    await preencher('E-mail', 'ana@exemplo.com')
    await preencher('Senha', 'errada123')
    await fireEvent.press(botao('Entrar'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/E-mail ou senha incorretos\./)
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('ana@exemplo.com')
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('RATE_LIMITED mostra a contagem regressiva a partir do Retry-After e desabilita os campos', async () => {
    respostasAuth.set(
      '/auth/login',
      erroApi(429, 'RATE_LIMITED', 'Muitas tentativas.', [], {
        cabecalhos: { 'retry-after': '900' },
      }),
    )
    await abrir('/login')

    await preencher('E-mail', 'ana@exemplo.com')
    await preencher('Senha', 'errada123')
    await fireEvent.press(botao('Entrar'))

    expect(await screen.findByText('Login bloqueado temporariamente')).toBeOnTheScreen()
    expect(screen.getByText(/Tente novamente em 15:00\./)).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail')).not.toBeEnabled()
    expect(screen.getByLabelText('Senha')).not.toBeEnabled()
    expect(botao('Entrar')).toBeDisabled()
  })

  it('CONTA_DESATIVADA mostra o aviso com o contato da diretoria', async () => {
    const mensagem = 'Sua conta está desativada. Procure a diretoria da Atlética Teste.'
    respostasAuth.set('/auth/login', erroApi(401, 'CONTA_DESATIVADA', mensagem))
    await abrir('/login')

    await preencher('E-mail', 'ana@exemplo.com')
    await preencher('Senha', 'senha2026')
    await fireEvent.press(botao('Entrar'))

    expect(await screen.findByText('Conta desativada')).toBeOnTheScreen()
    expect(screen.getByText(mensagem)).toBeOnTheScreen()
    expect(screen.getByText('Contato da diretoria: diretoria@exemplo.com')).toBeOnTheScreen()
    expect(useSessao.getState().status).toBe('anonimo')
  })

  it('offline: botão desabilitado, mensagem de conexão e nenhuma chamada à API', async () => {
    respostasAuth.set('/auth/login', { status: 200, corpo: sessao })
    await abrir('/login')
    await act(() => netInfo.__emitir({ isConnected: false, isInternetReachable: false }))

    await preencher('E-mail', 'ana@exemplo.com')
    await preencher('Senha', 'senha2026')
    await fireEvent.press(botao('Entrar'))

    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
    expect(botao('Entrar')).toBeDisabled()
    expect(chamadasPara('/auth/login')).toEqual([])
  })

  it('"Criar conta" leva o e-mail ao cadastro e "Já tenho conta" o traz de volta', async () => {
    const caminho = await abrir('/login')

    await preencher('E-mail', 'ana@exemplo.com')
    await fireEvent.press(screen.getByRole('link', { name: 'Criar conta' }))
    expect(await screen.findByRole('header', { name: 'Atlética Teste' })).toBeOnTheScreen()
    expect(caminho()).toBe('/cadastro')
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('ana@exemplo.com')

    await preencher('E-mail', 'bia@exemplo.com')
    await fireEvent.press(screen.getByRole('link', { name: 'Já tenho conta' }))
    await waitFor(() => expect(caminho()).toBe('/login'))
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('bia@exemplo.com')
  })
})

describe('cadastro', () => {
  it('"Criar conta" fica desabilitado sem o aceite dos Termos', async () => {
    await abrir('/cadastro')
    await preencherCadastro()
    expect(botao('Criar conta')).toBeDisabled()

    await fireEvent.press(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(botao('Criar conta')).toBeEnabled()
  })

  it('erro de campo destaca a regra e mantém os valores', async () => {
    await abrir('/cadastro')
    await preencherCadastro({ Senha: 'abcdefgh', 'Confirmar senha': 'abcdefgh' })
    await fireEvent.press(screen.getByRole('checkbox'))
    await fireEvent.press(botao('Criar conta'))

    expect(await screen.findByText('A senha deve ter ao menos um número.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Nome')).toHaveDisplayValue('Ana Souza')
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('ana@exemplo.com')
    expect(screen.getByLabelText('Senha')).toHaveDisplayValue('abcdefgh')
    expect(chamadasPara('/auth/cadastro')).toEqual([])
  })

  it('409 EMAIL_JA_CADASTRADO mostra o erro no campo e as ações "Entrar" e "Esqueci minha senha"', async () => {
    const mensagem = 'Este e-mail já está cadastrado.'
    respostasAuth.set(
      '/auth/cadastro',
      erroApi(409, 'EMAIL_JA_CADASTRADO', mensagem, [{ field: 'email', message: mensagem }]),
    )
    const caminho = await abrir('/cadastro')
    await preencherCadastro()
    await fireEvent.press(screen.getByRole('checkbox'))
    await fireEvent.press(botao('Criar conta'))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(botao('Esqueci minha senha')).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()

    await fireEvent.press(botao('Entrar'))
    await waitFor(() => expect(caminho()).toBe('/login'))
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('ana@exemplo.com')
  })

  it('sucesso envia a versão dos termos, inicia a sessão, mostra o toast e abre o Início', async () => {
    respostasAuth.set('/auth/cadastro', { status: 201, corpo: sessao })
    const caminho = await abrir('/cadastro')
    await preencherCadastro()
    await fireEvent.press(screen.getByRole('checkbox'))
    await fireEvent.press(botao('Criar conta'))

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(caminho()).toBe('/')
    expect(chamadasPara('/auth/cadastro')).toEqual([
      {
        nome: 'Ana Souza',
        email: 'ana@exemplo.com',
        senha: 'senha2026',
        aceiteTermos: true,
        versaoTermos: TERMOS_VERSAO,
      },
    ])
    expect(useSessao.getState().usuario).toEqual(sessao.usuario)
    expect(toast.sucesso).toHaveBeenCalledWith('Conta criada com sucesso')
  })

  it('offline não chama a API', async () => {
    await abrir('/cadastro')
    await act(() => netInfo.__emitir({ isConnected: false, isInternetReachable: false }))
    await preencherCadastro()
    await fireEvent.press(screen.getByRole('checkbox'))
    await fireEvent.press(botao('Criar conta'))

    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
    expect(botao('Criar conta')).toBeDisabled()
    expect(chamadasPara('/auth/cadastro')).toEqual([])
  })
})

describe('telas legais', () => {
  it.each([
    ['/termos', 'Termos de Uso'],
    ['/privacidade', 'Política de Privacidade'],
  ])('%s abre sem sessão com a faixa "Texto provisório"', async (rota, titulo) => {
    const caminho = await abrir(rota)
    expect(caminho()).toBe(rota)
    expect(screen.getByRole('header', { name: titulo })).toBeOnTheScreen()
    expect(screen.getByText('Texto provisório')).toBeOnTheScreen()
  })

  it('/termos também abre com sessão', async () => {
    itensSeguros.set(CHAVE_REFRESH_TOKEN, sessao.refreshToken)
    await AsyncStorage.setItem(
      CHAVE_DADOS_SESSAO,
      JSON.stringify({ usuario: sessao.usuario, accessTokenExpiraEm: sessao.accessTokenExpiraEm }),
    )
    const caminho = await abrir('/termos')
    expect(caminho()).toBe('/termos')
    expect(screen.getByText('Texto provisório')).toBeOnTheScreen()
  })

  it('os links do cadastro abrem os Termos e a Política', async () => {
    const caminho = await abrir('/cadastro')
    await fireEvent.press(screen.getByRole('link', { name: 'Termos de Uso' }))
    expect(await screen.findByText('Texto provisório')).toBeOnTheScreen()
    expect(caminho()).toBe('/termos')
  })
})
