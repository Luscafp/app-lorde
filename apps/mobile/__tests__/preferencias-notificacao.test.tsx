import type { Preferencias } from '@atletica/shared'
import NetInfo from '@react-native-community/netinfo'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import { MENSAGEM_SEM_CONEXAO } from '@/components/estado'
import { toast } from '@/components/ui/toast'
import { features } from '@/config/features'
import {
  MENSAGEM_CARGO_SEMPRE,
  MENSAGEM_ERRO_SALVAR,
  MENSAGEM_PERMISSAO_NEGADA,
  TelaPreferenciasNotificacao,
  type EstadoPermissao,
  type FontePermissao,
} from '@/features/notificacoes'
import { ApiErro } from '@/infra/api/api-erro'
import { api } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { configurarRede } from '@/infra/rede/online'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/infra/api/cliente', () => ({
  ...jest.requireActual<object>('@/infra/api/cliente'),
  api: { get: jest.fn(), patch: jest.fn() },
}))
jest.mock('@/config/features', () => ({
  features: { notificacoes: false, avisosHabilitados: false },
}))

const get = jest.mocked(api.get)
const patch = jest.mocked(api.patch)
const flags = features as { notificacoes: boolean; avisosHabilitados: boolean }
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }
const emitirRede = (online: boolean) =>
  act(() => netInfo.__emitir({ isConnected: online, isInternetReachable: online }))

const PADRAO: Preferencias = {
  pushAtivo: true,
  novosEventos: true,
  alteracoesEventos: true,
  lembretes: true,
  antecedenciaLembreteHoras: 2,
  resultados: true,
  noticias: true,
  solicitacoes: true,
  avisos: true,
}

const ROTULOS_R2 = [
  'Novos eventos',
  'Alterações e cancelamentos',
  'Lembretes',
  'Resultados',
  'Notícias',
  'Solicitações',
]

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = (permissao?: FontePermissao) =>
  render(<TelaPreferenciasNotificacao permissao={permissao} />, { wrapper: Provedor })

const interruptor = (nome: string) => screen.getByRole('switch', { name: nome })
const antecedencia = (horas: number) => screen.getByRole('tab', { name: `${horas} h` })
const alternar = (nome: string, valor: boolean) =>
  fireEvent(interruptor(nome), 'valueChange', valor)

function pendente<T>() {
  let resolver: (valor: T) => void = () => undefined
  let rejeitar: (erro: unknown) => void = () => undefined
  const promessa = new Promise<T>((ok, falha) => {
    resolver = ok
    rejeitar = falha
  })
  return { promessa, resolver, rejeitar }
}

function resolverCom<T>(alvo: { resolver: (valor: T) => void; promessa: Promise<T> }, valor: T) {
  alvo.resolver(valor)
  return alvo.promessa
}

function definirPapel(papel: 'ATLETA' | 'DIRETOR') {
  useSessao.setState({
    status: 'autenticado',
    usuario: { id: 'u-eu', nome: 'Eu', email: 'e@x.com', fotoUrl: null, papel, atleticaId: 'a1' },
  })
}

function fonteFalsa(...estados: EstadoPermissao[]) {
  const fila = [...estados]
  return {
    estado: jest.fn(() =>
      Promise.resolve((fila.length > 1 ? fila.shift() : fila[0]) as EstadoPermissao),
    ),
    solicitarERegistrar: jest.fn(() => Promise.resolve()),
  }
}

beforeAll(() => configurarRede())

beforeEach(async () => {
  jest.clearAllMocks()
  flags.notificacoes = false
  flags.avisosHabilitados = false
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  await emitirRede(true)
  definirPapel('ATLETA')
  get.mockResolvedValue(PADRAO)
})

afterEach(() => {
  cliente.clear()
})

describe('Tela Notificações (#37)', () => {
  it('padrões: tudo ligado e antecedência 2 h (critério 1)', async () => {
    await renderizar()

    expect(await screen.findByRole('switch', { name: 'Notificações push' })).toBeChecked()
    for (const rotulo of ROTULOS_R2) expect(interruptor(rotulo)).toBeChecked()
    expect(antecedencia(2)).toBeSelected()
    expect(get).toHaveBeenCalledWith('/me/preferencias-notificacao', expect.anything())
    expect(screen.getByText(MENSAGEM_CARGO_SEMPRE)).toBeOnTheScreen()
  })

  it('"Alterações e cancelamentos" com a descrição da 3.4 (critério 18)', async () => {
    await renderizar()

    expect(
      await screen.findByText('Mudança de data, horário ou local e cancelamentos'),
    ).toBeOnTheScreen()
  })

  it('desligar Notícias muda na hora e envia só o campo (critério 2)', async () => {
    const resposta = pendente<Preferencias>()
    patch.mockReturnValue(resposta.promessa)
    await renderizar()
    await screen.findByRole('switch', { name: 'Notícias' })

    await alternar('Notícias', false)

    await waitFor(() => expect(interruptor('Notícias')).not.toBeChecked())
    expect(patch).toHaveBeenCalledWith('/me/preferencias-notificacao', { noticias: false })
    get.mockResolvedValue({ ...PADRAO, noticias: false })
    await act(() => resolverCom(resposta, { ...PADRAO, noticias: false }))
    expect(await screen.findByText('Salvo')).toBeOnTheScreen()
    expect(interruptor('Notícias')).not.toBeChecked()
    expect(toast.erro).not.toHaveBeenCalled()
    expect(toast.sucesso).not.toHaveBeenCalled()
  })

  it('erro 500 volta o interruptor e mostra o toast próprio (critério 10)', async () => {
    patch.mockRejectedValue(new ApiErro({ status: 500, code: 'INTERNAL', message: 'Falhou' }))
    await renderizar()
    await screen.findByRole('switch', { name: 'Resultados' })

    await alternar('Resultados', false)

    await waitFor(() => expect(interruptor('Resultados')).toBeChecked())
    expect(toast.erro).toHaveBeenCalledTimes(1)
    expect(toast.erro).toHaveBeenCalledWith(MENSAGEM_ERRO_SALVAR)
  })

  it('toques rápidos: os PATCHs vão em fila e a resposta antiga não desfaz o novo', async () => {
    const primeira = pendente<Preferencias>()
    const segunda = pendente<Preferencias>()
    patch.mockReturnValueOnce(primeira.promessa).mockReturnValueOnce(segunda.promessa)
    await renderizar()
    await screen.findByRole('switch', { name: 'Notícias' })

    await alternar('Notícias', false)
    await alternar('Resultados', false)
    expect(patch).toHaveBeenCalledTimes(1)
    const leituras = get.mock.calls.length

    await act(() => resolverCom(primeira, { ...PADRAO, noticias: false }))
    await waitFor(() => expect(interruptor('Resultados')).not.toBeChecked())
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2))
    expect(patch).toHaveBeenLastCalledWith('/me/preferencias-notificacao', { resultados: false })
    expect(get).toHaveBeenCalledTimes(leituras)

    const final = { ...PADRAO, noticias: false, resultados: false }
    get.mockResolvedValue(final)
    await act(() => resolverCom(segunda, final))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(leituras + 1))
    expect(interruptor('Notícias')).not.toBeChecked()
    expect(interruptor('Resultados')).not.toBeChecked()
  })

  it('geral desligado: categorias desabilitadas com os valores preservados (critério 4)', async () => {
    get.mockResolvedValue({ ...PADRAO, pushAtivo: false, noticias: false })
    await renderizar()

    expect(await screen.findByRole('switch', { name: 'Notificações push' })).not.toBeChecked()
    for (const rotulo of ROTULOS_R2) expect(interruptor(rotulo)).toBeDisabled()
    expect(interruptor('Notícias')).not.toBeChecked()
    expect(interruptor('Resultados')).toBeChecked()
    expect(antecedencia(6)).toBeDisabled()

    patch.mockResolvedValue({ ...PADRAO, noticias: false })
    get.mockResolvedValue({ ...PADRAO, noticias: false })
    await alternar('Notificações push', true)

    await waitFor(() => expect(interruptor('Notícias')).toBeEnabled())
    expect(interruptor('Notícias')).not.toBeChecked()
    expect(patch).toHaveBeenCalledWith('/me/preferencias-notificacao', { pushAtivo: true })
  })

  it('Lembretes desligado desabilita a antecedência (critério 6)', async () => {
    get.mockResolvedValue({ ...PADRAO, lembretes: false })
    await renderizar()
    await screen.findByRole('switch', { name: 'Lembretes' })

    for (const horas of [1, 2, 6, 24]) expect(antecedencia(horas)).toBeDisabled()
  })

  it('escolher 24 h envia a antecedência', async () => {
    patch.mockResolvedValue({ ...PADRAO, antecedenciaLembreteHoras: 24 })
    await renderizar()
    get.mockResolvedValue({ ...PADRAO, antecedenciaLembreteHoras: 24 })
    await screen.findByRole('switch', { name: 'Lembretes' })

    await fireEvent.press(antecedencia(24))

    await waitFor(() => expect(antecedencia(24)).toBeSelected())
    expect(patch).toHaveBeenCalledWith('/me/preferencias-notificacao', {
      antecedenciaLembreteHoras: 24,
    })
  })

  it('tocar na antecedência já escolhida não envia PATCH', async () => {
    await renderizar()
    await screen.findByRole('switch', { name: 'Lembretes' })

    await fireEvent.press(antecedencia(2))

    expect(patch).not.toHaveBeenCalled()
  })

  it('"Salvo" some sozinho depois do sucesso', async () => {
    patch.mockResolvedValue({ ...PADRAO, noticias: false })
    await renderizar()
    await screen.findByRole('switch', { name: 'Notícias' })

    await alternar('Notícias', false)

    expect(await screen.findByText('Salvo')).toBeOnTheScreen()
    await waitFor(() => expect(screen.queryByText('Salvo')).toBeNull(), { timeout: 3000 })
  })

  it.each([
    ['ATLETA', 'Resposta às minhas solicitações de entrada.'],
    ['DIRETOR', 'Resposta às minhas solicitações de entrada e novas solicitações.'],
  ] as const)('Solicitações para %s: "%s" (critério 13)', async (papel, texto) => {
    definirPapel(papel)
    await renderizar()

    expect(await screen.findByText(texto)).toBeOnTheScreen()
  })

  it('flag avisosHabilitados desligada: sem "Avisos da diretoria" (critério 14)', async () => {
    await renderizar()

    await screen.findByRole('switch', { name: 'Notícias' })
    expect(screen.queryByRole('switch', { name: 'Avisos da diretoria' })).toBeNull()
  })

  it('flag avisosHabilitados ligada (#38): "Avisos da diretoria" aparece', async () => {
    flags.avisosHabilitados = true
    await renderizar()

    expect(await screen.findByRole('switch', { name: 'Avisos da diretoria' })).toBeChecked()
  })

  describe('offline (critério 16)', () => {
    it('com cache: valores e interruptores desabilitados com a faixa', async () => {
      cliente.setQueryData(chaves.me.preferencias(), { ...PADRAO, noticias: false })
      await emitirRede(false)
      await renderizar()

      expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
      expect(interruptor('Notícias')).not.toBeChecked()
      expect(interruptor('Notificações push')).toBeDisabled()
      for (const rotulo of ROTULOS_R2) expect(interruptor(rotulo)).toBeDisabled()
    })

    it('sem cache: estado "Sem conexão"', async () => {
      await emitirRede(false)
      await renderizar()

      expect(await screen.findByText(MENSAGEM_SEM_CONEXAO)).toBeOnTheScreen()
    })
  })

  describe('permissão do Android (UC12 A1)', () => {
    let ouvintes: ((status: AppStateStatus) => void)[]
    const aoMudarApp = (status: AppStateStatus) => ouvintes.forEach((ouvinte) => ouvinte(status))

    beforeEach(() => {
      flags.notificacoes = true
      ouvintes = []
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, aoMudar) => {
        ouvintes.push(aoMudar)
        return { remove: () => (ouvintes = ouvintes.filter((ouvinte) => ouvinte !== aoMudar)) }
      })
    })

    afterEach(() => jest.restoreAllMocks())

    it('flag notificacoes desligada: sem bloco e preferências editáveis (critério 17)', async () => {
      flags.notificacoes = false
      const fonte = fonteFalsa({ permissao: 'negada', registrado: false })
      await renderizar(fonte)

      expect(await screen.findByRole('switch', { name: 'Notícias' })).toBeEnabled()
      expect(screen.queryByText(MENSAGEM_PERMISSAO_NEGADA)).toBeNull()
      expect(fonte.estado).not.toHaveBeenCalled()
    })

    it('negada: faixa e "Abrir configurações" abre o sistema (critério 11)', async () => {
      const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
      await renderizar(fonteFalsa({ permissao: 'negada', registrado: false }))

      expect(await screen.findByText(MENSAGEM_PERMISSAO_NEGADA)).toBeOnTheScreen()
      expect(interruptor('Notícias')).toBeEnabled()
      await fireEvent.press(screen.getByRole('button', { name: 'Abrir configurações' }))
      expect(abrir).toHaveBeenCalled()
    })

    it('ao voltar ao app com a permissão concedida, a faixa some e registra (critério 12)', async () => {
      const fonte = fonteFalsa(
        { permissao: 'negada', registrado: false },
        { permissao: 'concedida', registrado: false },
      )
      await renderizar(fonte)
      await screen.findByText(MENSAGEM_PERMISSAO_NEGADA)
      expect(fonte.solicitarERegistrar).not.toHaveBeenCalled()

      await act(() => {
        aoMudarApp('active')
        return Promise.resolve()
      })

      await waitFor(() => expect(screen.queryByText(MENSAGEM_PERMISSAO_NEGADA)).toBeNull())
      expect(fonte.solicitarERegistrar).toHaveBeenCalledTimes(1)
    })

    it('falha no registro não se repete ao voltar ao app', async () => {
      const fonte = fonteFalsa({ permissao: 'concedida', registrado: false })
      fonte.solicitarERegistrar.mockRejectedValue(new Error('falhou'))
      await renderizar(fonte)
      await waitFor(() => expect(fonte.solicitarERegistrar).toHaveBeenCalledTimes(1))

      await act(() => {
        aoMudarApp('active')
        return Promise.resolve()
      })

      await waitFor(() => expect(fonte.estado).toHaveBeenCalledTimes(2))
      expect(fonte.solicitarERegistrar).toHaveBeenCalledTimes(1)
      expect(interruptor('Notícias')).toBeEnabled()
    })

    it('concedida e já registrado: nada a mostrar nem registrar', async () => {
      const fonte = fonteFalsa({ permissao: 'concedida', registrado: true })
      await renderizar(fonte)
      await screen.findByRole('switch', { name: 'Notícias' })

      await waitFor(() => expect(fonte.estado).toHaveBeenCalled())
      expect(fonte.solicitarERegistrar).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Permitir notificações' })).toBeNull()
    })

    it('ainda não perguntada: "Permitir notificações" pede e registra', async () => {
      const fonte = fonteFalsa(
        { permissao: 'nao-perguntada', registrado: false },
        { permissao: 'concedida', registrado: true },
      )
      await renderizar(fonte)

      await fireEvent.press(await screen.findByRole('button', { name: 'Permitir notificações' }))

      expect(fonte.solicitarERegistrar).toHaveBeenCalledTimes(1)
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Permitir notificações' })).toBeNull(),
      )
    })
  })
})
