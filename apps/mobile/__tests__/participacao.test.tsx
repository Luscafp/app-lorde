import type { EventoDetalheDto, ListaEventos, ParticipacaoRespondidaDto } from '@atletica/shared'
import NetInfo from '@react-native-community/netinfo'
import { QueryClientProvider, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { TelaEvento } from '@/features/eventos'
import { ParticipacaoAcoes, SecaoMeusProximosEventos } from '@/features/participacoes'
import { contagemComResposta } from '@/features/participacoes/hooks'
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
  api: { get: jest.fn(), put: jest.fn() },
}))

const get = jest.mocked(api.get)
const put = jest.mocked(api.put)
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }
const emitirRede = (online: boolean) =>
  act(() => netInfo.__emitir({ isConnected: online, isInternetReachable: online }))

const ID = '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'
const TIME = '0b6f1f0e-2b7a-4d4e-9a65-1c2b3c4d5e60'
const DIA_MS = 24 * 60 * 60 * 1000
const CONTAGEM = { confirmados: 8, recusados: 2, semResposta: 4, elenco: 14 }

function detalhe(parcial: Partial<EventoDetalheDto> = {}): EventoDetalheDto {
  return {
    id: ID,
    tipo: 'TREINO',
    status: 'AGENDADO',
    inicio: new Date(Date.now() + 7 * DIA_MS).toISOString(),
    local: 'Ginásio Castelinho',
    observacoes: null,
    serieId: null,
    time: { id: TIME, nome: 'Lorde Vôlei Masculino' },
    modalidade: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', nome: 'Vôlei', icone: 'volleyball' },
    timeAdversario: null,
    placarTime: null,
    placarAdversario: null,
    resultado: null,
    criadoEm: '2026-10-01T12:00:00.000Z',
    atualizadoEm: '2026-10-01T12:00:00.000Z',
    serie: null,
    contagem: CONTAGEM,
    confirmados: [],
    souMembro: true,
    minhaParticipacao: null,
    podeResponder: true,
    motivoBloqueioResposta: null,
    ...parcial,
  }
}

function respondida(confirmado: boolean, contagem = CONTAGEM): ParticipacaoRespondidaDto {
  return { eventoId: ID, confirmado, respondidoEm: '2026-10-08T14:32:10.000Z', contagem }
}

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

function renderizar(aoAbrirTime = jest.fn()) {
  return render(
    <TelaEvento
      id={ID}
      aoGerenciar={jest.fn()}
      acoesParticipacao={(evento) => (
        <ParticipacaoAcoes evento={evento} aoAbrirTime={aoAbrirTime} />
      )}
    />,
    { wrapper: Provedor },
  )
}

const botao = (nome: 'Vou' | 'Não vou') => screen.getByRole('button', { name: nome })
const legenda = () => screen.getByTestId('legenda-participacao')
const contagem = () => screen.getByTestId('contagem')

function pendente<T>() {
  let resolver: (valor: T) => void = () => undefined
  let rejeitar: (erro: unknown) => void = () => undefined
  const promessa = new Promise<T>((ok, falha) => {
    resolver = ok
    rejeitar = falha
  })
  return { promessa, resolver, rejeitar }
}

beforeAll(() => configurarRede())

beforeEach(async () => {
  jest.clearAllMocks()
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  await emitirRede(true)
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: 'u-eu',
      nome: 'Eu',
      email: 'e@x.com',
      fotoUrl: null,
      papel: 'ATLETA',
      atleticaId: 'a1',
    },
  })
})

afterEach(() => {
  jest.useRealTimers()
  cliente.clear()
})

describe('ParticipacaoAcoes — estados (§6)', () => {
  it('fora do elenco: sem botões, aviso e "Ver time" (critério 5)', async () => {
    get.mockResolvedValue(
      detalhe({
        souMembro: false,
        podeResponder: false,
        motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
      }),
    )
    const aoAbrirTime = jest.fn()
    await renderizar(aoAbrirTime)

    expect(
      await screen.findByText('Apenas membros do elenco podem confirmar participação'),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Vou' })).toBeNull()
    await fireEvent.press(screen.getByRole('link', { name: 'Ver time' }))
    expect(aoAbrirTime).toHaveBeenCalledWith(TIME)
  })

  it('fora do elenco e cancelado: nada é exibido', async () => {
    get.mockResolvedValue(
      detalhe({
        status: 'CANCELADO',
        souMembro: false,
        podeResponder: false,
        motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
      }),
    )
    await renderizar()
    await screen.findByTestId('contagem')
    expect(screen.queryByText(/Apenas membros/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Vou' })).toBeNull()
  })

  it('sem resposta: os dois botões habilitados e "Você ainda não respondeu"', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()

    expect(await screen.findByRole('button', { name: 'Vou' })).toBeEnabled()
    expect(botao('Não vou')).toBeEnabled()
    expect(legenda()).toHaveTextContent('Você ainda não respondeu')
  })

  it('com resposta: a atual em destaque e a data da resposta', async () => {
    get.mockResolvedValue(
      detalhe({
        minhaParticipacao: { confirmado: true, respondidoEm: '2026-10-01T12:00:00.000Z' },
      }),
    )
    await renderizar()

    expect(await screen.findByRole('button', { name: 'Vou' })).toBeSelected()
    expect(botao('Não vou')).not.toBeSelected()
    expect(legenda()).toHaveTextContent(
      'Respondido em 01/10/2026 09:00 · você pode alterar até o início',
    )
  })

  it.each([
    ['CANCELADO', 'EVENTO_CANCELADO', 'Evento cancelado'],
    ['EM_ANDAMENTO', 'EVENTO_NAO_AGENDADO', 'O evento já começou'],
    ['FINALIZADO', 'EVENTO_NAO_AGENDADO', 'Evento finalizado'],
    ['AGENDADO', 'EVENTO_JA_INICIADO', 'O evento já começou'],
  ] as const)(
    '%s (%s): botões desabilitados com "%s" (critérios 6 e 7)',
    async (status, motivo, texto) => {
      get.mockResolvedValue(
        detalhe({ status, podeResponder: false, motivoBloqueioResposta: motivo }),
      )
      await renderizar()

      expect(await screen.findByRole('button', { name: 'Vou' })).toBeDisabled()
      expect(botao('Não vou')).toBeDisabled()
      expect(botao('Vou')).toHaveStyle({ opacity: 0.55 })
      expect(legenda()).toHaveTextContent(texto)
    },
  )

  it('offline com evento cancelado: o motivo vence "Sem conexão"', async () => {
    get.mockResolvedValue(
      detalhe({
        status: 'CANCELADO',
        podeResponder: false,
        motivoBloqueioResposta: 'EVENTO_CANCELADO',
      }),
    )
    await renderizar()
    await screen.findByRole('button', { name: 'Vou' })

    await emitirRede(false)

    expect(botao('Vou')).toBeDisabled()
    expect(legenda()).toHaveTextContent('Evento cancelado')
  })

  it('offline: botões desabilitados, "Sem conexão" e nenhuma requisição (critério 13)', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    await screen.findByRole('button', { name: 'Vou' })

    await emitirRede(false)

    expect(botao('Vou')).toBeDisabled()
    expect(legenda()).toHaveTextContent('Sem conexão')
    await fireEvent.press(botao('Vou'))
    expect(put).not.toHaveBeenCalled()
  })

  it('desabilita sozinho quando o relógio passa do início, sem esperar o servidor', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-10T21:59:10.000Z') })
    get.mockResolvedValue(detalhe({ inicio: '2026-10-10T22:00:00.000Z' }))
    await renderizar()
    expect(await screen.findByRole('button', { name: 'Vou' })).toBeEnabled()

    await act(() => jest.advanceTimersByTimeAsync(60_000))

    expect(botao('Vou')).toBeDisabled()
    expect(legenda()).toHaveTextContent('O evento já começou')
  })
})

describe('ParticipacaoAcoes — resposta', () => {
  it('"Vou": PUT, contagem otimista, toast e invalidação da Agenda (critérios 1 e 14)', async () => {
    const agenda: InfiniteData<ListaEventos> = { pages: [], pageParams: [] }
    cliente.setQueryData(chaves.eventos.lista({ periodo: 'PROXIMOS' }), agenda)
    get.mockResolvedValue(detalhe())
    const resposta = pendente<ParticipacaoRespondidaDto>()
    put.mockReturnValue(resposta.promessa)
    await renderizar()

    await fireEvent.press(await screen.findByRole('button', { name: 'Vou' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/eventos/${ID}/participacao`, { confirmado: true }),
    )
    await waitFor(() => expect(contagem()).toHaveTextContent('9 vão · 2 não vão · 3 sem resposta'))
    expect(screen.getByTestId('botao-spinner')).toBeOnTheScreen()

    const novaContagem = { confirmados: 9, recusados: 2, semResposta: 3, elenco: 14 }
    await act(async () => {
      resposta.resolver(respondida(true, novaContagem))
      await resposta.promessa
    })

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Participação confirmada'))
    expect(
      cliente.getQueryState(chaves.eventos.lista({ periodo: 'PROXIMOS' }))?.isInvalidated,
    ).toBe(true)
  })

  it('"Vou" → "Não vou": contagem troca e toast "Você marcou que não vai" (critério 2)', async () => {
    get.mockResolvedValue(
      detalhe({
        minhaParticipacao: { confirmado: true, respondidoEm: '2026-10-01T12:00:00.000Z' },
      }),
    )
    put.mockResolvedValue(respondida(false))
    await renderizar()

    await fireEvent.press(await screen.findByRole('button', { name: 'Não vou' }))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Você marcou que não vai'))
    expect(put).toHaveBeenCalledWith(`/eventos/${ID}/participacao`, { confirmado: false })
  })

  it('422 EVENTO_JA_INICIADO: desfaz o otimista, toast da API e recarrega o detalhe (critério 9)', async () => {
    get.mockResolvedValue(detalhe())
    const mensagem = 'O evento já começou; não é possível alterar a resposta.'
    put.mockRejectedValue(
      new ApiErro({ status: 422, code: 'EVENTO_JA_INICIADO', message: mensagem }),
    )
    await renderizar()
    await screen.findByRole('button', { name: 'Vou' })
    const buscasAntes = get.mock.calls.length

    get.mockResolvedValue(
      detalhe({ podeResponder: false, motivoBloqueioResposta: 'EVENTO_JA_INICIADO' }),
    )
    await fireEvent.press(botao('Vou'))

    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(mensagem))
    await waitFor(() => expect(botao('Vou')).toBeDisabled())
    expect(get.mock.calls.length).toBeGreaterThan(buscasAntes)
    expect(contagem()).toHaveTextContent('8 vão · 2 não vão · 4 sem resposta')
    expect(legenda()).toHaveTextContent('O evento já começou')
    expect(toast.sucesso).not.toHaveBeenCalled()
  })

  it('dois toques rápidos enviam uma requisição (critério 15)', async () => {
    get.mockResolvedValue(detalhe())
    put.mockReturnValue(pendente<ParticipacaoRespondidaDto>().promessa)
    await renderizar()

    const vou = await screen.findByRole('button', { name: 'Vou' })
    await fireEvent.press(vou)
    await fireEvent.press(vou)
    await fireEvent.press(botao('Não vou'))

    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vou' })).toBeDisabled())
  })

  it('tocar na opção já selecionada não envia nada', async () => {
    get.mockResolvedValue(
      detalhe({
        minhaParticipacao: { confirmado: false, respondidoEm: '2026-10-01T12:00:00.000Z' },
      }),
    )
    await renderizar()

    await fireEvent.press(await screen.findByRole('button', { name: 'Não vou' }))

    expect(put).not.toHaveBeenCalled()
  })
})

describe('SecaoMeusProximosEventos', () => {
  it('consulta exata: PROXIMOS, confirmadoPorMim e limit 5', async () => {
    get.mockResolvedValue({ items: [], page: 1, limit: 5, total: 0 })
    await render(<SecaoMeusProximosEventos aoAbrirEvento={jest.fn()} />, { wrapper: Provedor })

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    const [rota, opcoes] = get.mock.calls[0]!
    expect(rota).toBe('/eventos')
    expect(opcoes?.consulta).toEqual({
      periodo: 'PROXIMOS',
      confirmadoPorMim: true,
      page: 1,
      limit: 5,
    })
  })
})

describe('contagemComResposta', () => {
  it.each([
    [undefined, true, { confirmados: 9, recusados: 2, semResposta: 3 }],
    [undefined, false, { confirmados: 8, recusados: 3, semResposta: 3 }],
    [true, false, { confirmados: 7, recusados: 3, semResposta: 4 }],
    [false, true, { confirmados: 9, recusados: 1, semResposta: 4 }],
    [true, true, { confirmados: 8, recusados: 2, semResposta: 4 }],
  ])('anterior %s → %s', (anterior, confirmado, esperado) => {
    expect(contagemComResposta(CONTAGEM, anterior, confirmado)).toEqual({
      ...esperado,
      elenco: 14,
    })
  })
})
