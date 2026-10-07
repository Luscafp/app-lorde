import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Papel } from '@atletica/shared'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { renderRouter, screen } from 'expo-router/testing-library'
import * as rotaApp from '../app/(app)/_layout'
import LayoutAbas from '../app/(app)/(abas)/_layout'
import * as rotaAgenda from '../app/(app)/(abas)/agenda/_layout'
import Agenda from '../app/(app)/(abas)/agenda/index'
import Inicio from '../app/(app)/(abas)/index'
import LayoutPainel from '../app/(app)/(abas)/painel/_layout'
import Painel from '../app/(app)/(abas)/painel/index'
import LayoutPerfil from '../app/(app)/(abas)/perfil/_layout'
import Perfil from '../app/(app)/(abas)/perfil/index'
import Time from '../app/(app)/(abas)/times/[timeId]'
import * as rotaTimes from '../app/(app)/(abas)/times/_layout'
import Times from '../app/(app)/(abas)/times/index'
import Evento from '../app/(app)/eventos/[id]'
import * as rotaPublica from '../app/(publico)/_layout'
import Cadastro from '../app/(publico)/cadastro'
import Login from '../app/(publico)/login'
import { redirectSystemPath } from '../app/+native-intent'
import PaginaNaoEncontrada from '../app/+not-found'
import LayoutRaiz from '../app/_layout'
import * as apiEventos from '@/features/eventos/api'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { consumirDestinoAposLogin } from '@/infra/sessao/destino'
import {
  CHAVE_DADOS_SESSAO,
  CHAVE_REFRESH_TOKEN,
  useSessao,
  type DadosSessao,
} from '@/infra/sessao/store'
import { eventoResumo, paginaEventos } from '../test-utils/eventos'

const rotas = {
  _layout: LayoutRaiz,
  '+not-found': PaginaNaoEncontrada,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': Login,
  '(publico)/cadastro': Cadastro,
  '(app)/_layout': rotaApp,
  '(app)/(abas)/_layout': LayoutAbas,
  '(app)/(abas)/index': Inicio,
  '(app)/(abas)/agenda/_layout': rotaAgenda,
  '(app)/(abas)/agenda/index': Agenda,
  '(app)/eventos/[id]': Evento,
  '(app)/(abas)/times/_layout': rotaTimes,
  '(app)/(abas)/times/index': Times,
  '(app)/(abas)/times/[timeId]': Time,
  '(app)/(abas)/perfil/_layout': LayoutPerfil,
  '(app)/(abas)/perfil/index': Perfil,
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

  it('deep link /times/:id abre o detalhe do time (#17)', async () => {
    const buscarTime = jest
      .spyOn(apiTimes, 'buscarTime')
      .mockRejectedValue(new ApiErro({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await comSessaoSalva('ATLETA')
    const rota = renderRouter(rotas, { initialUrl: '/times/b2a1c3d4' })
    await rota
    await waitFor(() => expect(rota.getPathname()).toBe('/times/b2a1c3d4'))
    expect(await screen.findByText('Time não encontrado')).toBeOnTheScreen()
    expect(buscarTime).toHaveBeenCalledWith('b2a1c3d4', expect.anything())
    expect(screen.queryByText('Página não encontrada')).toBeNull()
    buscarTime.mockRestore()
  })

  it('treino do time abre /eventos/:id e "Ver na agenda" abre a Agenda filtrada (#67)', async () => {
    const timeId = 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
    const modalidade = {
      id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
      nome: 'Futsal',
      icone: 'soccer',
    }
    const espioes = [
      jest.spyOn(apiTimes, 'buscarTime').mockResolvedValue({
        id: timeId,
        nome: 'Futsal Masculino',
        ativo: true,
        modalidade,
        atletica: { id: 'a1', nome: 'Lorde', sigla: 'LRD', propria: true },
        capitao: null,
        totalMembros: 0,
        minhaSituacao: null,
      }),
      jest.spyOn(apiTimes, 'buscarElenco').mockResolvedValue({ items: [], total: 0 }),
    ]
    const listarEventos = jest
      .spyOn(apiEventos, 'listarEventos')
      .mockResolvedValue(
        paginaEventos([
          eventoResumo('e1', { time: { id: timeId, nome: 'Futsal Masculino' }, modalidade }),
        ]),
      )
    await comSessaoSalva('ATLETA')
    const caminho = await abrir(`/times/${timeId}`)

    await fireEvent.press(await screen.findByRole('button', { name: /^Treino — Futsal Masculino/ }))
    await waitFor(() => expect(caminho()).toBe('/eventos/e1'))

    await act(() => router.back())
    await fireEvent.press(await screen.findByRole('link', { name: 'Ver na agenda' }))
    await waitFor(() => expect(caminho()).toBe('/agenda'))
    await waitFor(() =>
      expect(listarEventos).toHaveBeenLastCalledWith(
        { periodo: 'PROXIMOS', tipo: 'TREINO', modalidadeId: modalidade.id },
        1,
        expect.anything(),
      ),
    )
    ;[...espioes, listarEventos].forEach((espiao) => espiao.mockRestore())
  })

  it('deep link /agenda com filtros consulta a API com eles e o card abre /eventos/:id (#76)', async () => {
    const listarEventos = jest
      .spyOn(apiEventos, 'listarEventos')
      .mockResolvedValue(paginaEventos([eventoResumo('e1')], 20))
    await comSessaoSalva('ATLETA')
    const caminho = await abrir('/agenda?tipo=TREINO&modalidadeId=nao-uuid')

    const card = await screen.findByRole('button', { name: /^Treino — Futsal Masculino/ })
    expect(listarEventos).toHaveBeenCalledWith(
      { periodo: 'PROXIMOS', tipo: 'TREINO', modalidadeId: undefined },
      1,
      expect.anything(),
    )

    await fireEvent.press(card)
    await waitFor(() => expect(caminho()).toBe('/eventos/e1'))
    listarEventos.mockRestore()
  })

  it('"Limpar filtros" tira os filtros da URL e consulta sem eles (#76)', async () => {
    const listarEventos = jest
      .spyOn(apiEventos, 'listarEventos')
      .mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 })
    await comSessaoSalva('ATLETA')
    await abrir('/agenda?tipo=JOGO')

    await fireEvent.press(await screen.findByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() =>
      expect(listarEventos).toHaveBeenLastCalledWith(
        { periodo: 'PROXIMOS', tipo: undefined, modalidadeId: undefined },
        1,
        expect.anything(),
      ),
    )
    expect(await screen.findByText('Nenhum evento agendado')).toBeOnTheScreen()
    listarEventos.mockRestore()
  })

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

  it.each<[Papel, boolean]>([
    ['DIRETOR', false],
    ['VICE_PRESIDENTE', true],
    ['PRESIDENTE', true],
    ['ADMINISTRADOR', true],
  ])('Painel de %s mostra "Usuários": %s (#27)', async (papel, ve) => {
    await comSessaoSalva(papel)
    await abrir('/painel')
    expect(screen.queryByRole('link', { name: 'Usuários' }) !== null).toBe(ve)
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
