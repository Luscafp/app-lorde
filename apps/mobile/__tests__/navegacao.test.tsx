import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Papel } from '@atletica/shared'
import { act, fireEvent } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderRouter, screen } from 'expo-router/testing-library'
import * as rotaApp from '../app/(app)/_layout'
import LayoutAbas from '../app/(app)/(abas)/_layout'
import Agenda from '../app/(app)/(abas)/agenda'
import Inicio from '../app/(app)/(abas)/index'
import Painel from '../app/(app)/(abas)/painel/index'
import LayoutPainel from '../app/(app)/(abas)/painel/_layout'
import Perfil from '../app/(app)/(abas)/perfil'
import Times from '../app/(app)/(abas)/times'
import * as rotaPublica from '../app/(publico)/_layout'
import Cadastro from '../app/(publico)/cadastro'
import Login from '../app/(publico)/login'
import { redirectSystemPath } from '../app/+native-intent'
import PaginaNaoEncontrada from '../app/+not-found'
import LayoutRaiz from '../app/_layout'
import { consumirDestinoAposLogin } from '@/infra/sessao/destino'
import {
  CHAVE_DADOS_SESSAO,
  CHAVE_REFRESH_TOKEN,
  useSessao,
  type DadosSessao,
} from '@/infra/sessao/store'

const rotas = {
  _layout: LayoutRaiz,
  '+not-found': PaginaNaoEncontrada,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': Login,
  '(publico)/cadastro': Cadastro,
  '(app)/_layout': rotaApp,
  '(app)/(abas)/_layout': LayoutAbas,
  '(app)/(abas)/index': Inicio,
  '(app)/(abas)/agenda': Agenda,
  '(app)/(abas)/times': Times,
  '(app)/(abas)/perfil': Perfil,
  '(app)/(abas)/painel/_layout': LayoutPainel,
  '(app)/(abas)/painel/index': Painel,
}

const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens

function sessaoDe(papel: Papel): DadosSessao {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    accessTokenExpiraEm: '2026-10-01T22:15:00.000Z',
    usuario: { id: 'u1', nome: 'Ana', email: 'a@x.com', fotoUrl: null, papel, atleticaId: 'a1' },
  }
}

async function comSessaoSalva(papel: Papel) {
  const { usuario, refreshToken, accessTokenExpiraEm } = sessaoDe(papel)
  itensSeguros.set(CHAVE_REFRESH_TOKEN, refreshToken)
  await AsyncStorage.setItem(CHAVE_DADOS_SESSAO, JSON.stringify({ usuario, accessTokenExpiraEm }))
}

// renderRouter pendura getPathname() na promessa do render assíncrono do RNTL 14.
async function abrir(initialUrl = '/') {
  const rota = renderRouter(rotas, { initialUrl })
  await rota
  await screen.findByRole('header')
  return () => rota.getPathname()
}

beforeEach(async () => {
  global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')))
  itensSeguros.clear()
  await AsyncStorage.clear()
  consumirDestinoAposLogin()
  useSessao.setState({ status: 'carregando', usuario: null, accessToken: null, refreshToken: null })
})

describe('navegação', () => {
  it('sem sessão abre /login com o nome genérico', async () => {
    const caminho = await abrir()
    expect(caminho()).toBe('/login')
    expect(screen.getByText('Atlética')).toBeOnTheScreen()
  })

  it('sem sessão, rota protegida leva ao /login', async () => {
    const caminho = await abrir('/agenda')
    expect(caminho()).toBe('/login')
  })

  it('com sessão abre o Início', async () => {
    await comSessaoSalva('ATLETA')
    const caminho = await abrir()
    expect(caminho()).toBe('/')
    expect(screen.getByRole('header')).toHaveTextContent('Início')
  })

  it('ATLETA vê Início, Agenda, Times e Perfil, sem Painel', async () => {
    await comSessaoSalva('ATLETA')
    await abrir()
    for (const aba of ['Início', 'Agenda', 'Times', 'Perfil']) {
      expect(screen.getByLabelText(aba)).toBeOnTheScreen()
    }
    expect(screen.queryByLabelText('Painel')).toBeNull()
  })

  it.each<Papel>(['DIRETOR', 'PRESIDENTE', 'ADMINISTRADOR'])(
    '%s vê a aba Painel',
    async (papel) => {
      await comSessaoSalva(papel)
      await abrir()
      expect(screen.getByLabelText('Painel')).toBeOnTheScreen()
    },
  )

  it('deep link /painel de ATLETA redireciona ao Início', async () => {
    await comSessaoSalva('ATLETA')
    const caminho = await abrir('/painel')
    expect(caminho()).toBe('/')
  })

  it('deep link /painel de DIRETOR abre o Painel', async () => {
    await comSessaoSalva('DIRETOR')
    const caminho = await abrir('/painel')
    expect(caminho()).toBe('/painel')
  })

  it('a aba Painel acompanha o papel da store', async () => {
    await abrir()
    await act(() => useSessao.getState().iniciarSessao(sessaoDe('DIRETOR')))
    expect(await screen.findByLabelText('Painel')).toBeOnTheScreen()

    await act(() => useSessao.getState().atualizarUsuario({ papel: 'ATLETA' }))
    expect(screen.queryByLabelText('Painel')).toBeNull()
  })

  it('encerrarSessao leva ao /login', async () => {
    await comSessaoSalva('ATLETA')
    const caminho = await abrir('/agenda')
    await act(() => useSessao.getState().encerrarSessao({ motivo: 'SESSAO_EXPIRADA' }))
    expect(caminho()).toBe('/login')
  })

  it('deep link protegido sem sessão vai ao destino original depois do login', async () => {
    redirectSystemPath({ path: 'atletica://agenda', initial: true })
    const caminho = await abrir('/agenda')
    expect(caminho()).toBe('/login')

    await act(() => useSessao.getState().iniciarSessao(sessaoDe('ATLETA')))
    expect(caminho()).toBe('/agenda')
  })

  it('deep link com sessão já carregada não guarda destino', () => {
    useSessao.setState({ status: 'autenticado' })
    redirectSystemPath({ path: 'atletica://agenda', initial: false })
    expect(consumirDestinoAposLogin()).toBeNull()
  })

  it('rota inexistente mostra "Página não encontrada" e volta ao Início', async () => {
    await comSessaoSalva('ATLETA')
    const caminho = await abrir('/nao-existe')
    expect(screen.getByText('Página não encontrada')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('link', { name: 'Voltar ao Início' }))
    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(caminho()).toBe('/')
  })
})
