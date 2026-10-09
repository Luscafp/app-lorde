import type { ListaSolicitacoes, SolicitacaoPainelDto, TimeDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import { PainelSolicitacoes } from '@/features/solicitacoes'
import * as apiSolicitacoes from '@/features/solicitacoes/api'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/solicitacoes/api')
jest.mock('@/features/times/api')

const api = jest.mocked(apiSolicitacoes)
const apiTime = jest.mocked(apiTimes)

const FUTSAL = { id: 'm-futsal', nome: 'Futsal', icone: 'soccer' }

const timeProprio = (id: string, nome: string): TimeDto => ({
  id,
  nome,
  ativo: true,
  modalidade: FUTSAL,
  atletica: { id: 'a1', nome: 'Lorde', sigla: 'LRD', propria: true },
  capitao: null,
  totalMembros: 0,
})

function solicitacao(
  id: string,
  nome: string,
  extra: Partial<SolicitacaoPainelDto> = {},
): SolicitacaoPainelDto {
  return {
    id,
    status: 'PENDENTE',
    criadaEm: '2026-09-28T15:00:00.000Z',
    avaliadaEm: null,
    canceladaEm: null,
    usuario: { id: `u-${id}`, nome, fotoUrl: null },
    time: { id: 't-masc', nome: 'Futsal Masculino', modalidade: FUTSAL },
    avaliadoPor: null,
    ...extra,
  }
}

const CARLOS = solicitacao('s1', 'Carlos Lima')
const ANA = solicitacao('s2', 'Ana Souza')
const REJEITADA = solicitacao('s3', 'Bruno Reis', {
  status: 'REJEITADA',
  avaliadaEm: '2026-09-30T18:30:00.000Z',
  avaliadoPor: { id: 'd1', nome: 'Maria Diretora', fotoUrl: null },
})

const pagina = (items: SolicitacaoPainelDto[], total = items.length): ListaSolicitacoes => ({
  items,
  page: 1,
  limit: 20,
  total,
})

const erroApi = (status: number, code: string) =>
  new ApiErro({ status, code, message: `mensagem de ${code}` })

let cliente: QueryClient
let pendentes: SolicitacaoPainelDto[]

function servirLista() {
  api.listarSolicitacoes.mockImplementation((filtros, _pagina, _sinal, limit) => {
    if (limit === 1) return Promise.resolve(pagina([], pendentes.length))
    const status = filtros.status ?? []
    if (status.includes('PENDENTE')) return Promise.resolve(pagina(pendentes))
    return Promise.resolve(pagina([REJEITADA]))
  })
}

async function abrir() {
  await render(
    <QueryClientProvider client={cliente}>
      <PainelSolicitacoes />
    </QueryClientProvider>,
  )
  await screen.findByText('Carlos Lima')
}

const ultimoAlerta = () => jest.mocked(Alert.alert).mock.lastCall

async function tocarNoAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = ultimoAlerta()?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

function adiado<T>() {
  let concluir: (valor: T) => void = () => undefined
  let falhar: (erro: unknown) => void = () => undefined
  const promessa = new Promise<T>((resolver, rejeitar) => {
    concluir = resolver
    falhar = rejeitar
  })
  return { promessa, concluir, falhar }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  pendentes = [CARLOS, ANA]
  servirLista()
  apiTime.listarTimes.mockResolvedValue({
    items: [timeProprio('t-masc', 'Futsal Masculino'), timeProprio('t-fem', 'Vôlei Feminino')],
    page: 1,
    limit: 20,
    total: 2,
  })
})

afterEach(() => cliente.clear())

describe('Painel > Solicitações', () => {
  it('pendentes: nome, time, modalidade, data e total na aba (critério 10)', async () => {
    await abrir()

    expect(screen.getByRole('tab', { name: 'Pendentes (2)' })).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen()
    expect(screen.getAllByLabelText('Futsal Masculino, Futsal')).toHaveLength(2)
    expect(screen.getAllByTestId('icone-soccer')).toHaveLength(2)
    expect(screen.getAllByText('Solicitada em 28/09/2026 12:00')).toHaveLength(2)
    expect(api.listarSolicitacoes).toHaveBeenCalledWith(
      { status: ['PENDENTE'], timeId: undefined },
      1,
      expect.anything(),
    )
  })

  it('aceitar: sai da lista na hora, toast e recarrega times (critério 11)', async () => {
    const aprovacao = adiado<SolicitacaoPainelDto>()
    api.aprovarSolicitacao.mockReturnValue(aprovacao.promessa)
    const invalidar = jest.spyOn(cliente, 'invalidateQueries')
    await abrir()

    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar Carlos Lima' }))

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(api.aprovarSolicitacao).toHaveBeenCalledWith('s1')
    await waitFor(() => expect(screen.queryByText('Carlos Lima')).toBeNull())

    pendentes = [ANA]
    await act(() => aprovacao.concluir({ ...CARLOS, status: 'APROVADA' }))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Solicitação aceita'))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chaves.times.todos() })
    expect(await screen.findByRole('tab', { name: 'Pendentes (1)' })).toBeOnTheScreen()
  })

  it('rejeitar pede confirmação com nome e time (critério 12)', async () => {
    api.rejeitarSolicitacao.mockResolvedValue({ ...ANA, status: 'REJEITADA' })
    await abrir()

    await fireEvent.press(screen.getByRole('button', { name: 'Rejeitar Ana Souza' }))
    expect(ultimoAlerta()?.[1]).toBe('Rejeitar a solicitação de Ana Souza para o Futsal Masculino?')
    expect(api.rejeitarSolicitacao).not.toHaveBeenCalled()

    pendentes = [CARLOS]
    await tocarNoAlerta('Rejeitar')

    expect(api.rejeitarSolicitacao).toHaveBeenCalledWith('s2')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Solicitação rejeitada'))
    await waitFor(() => expect(screen.queryByText('Ana Souza')).toBeNull())
  })

  it('erro inesperado: o item volta (rollback)', async () => {
    const aprovacao = adiado<SolicitacaoPainelDto>()
    api.aprovarSolicitacao.mockReturnValue(aprovacao.promessa)
    await abrir()

    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar Carlos Lima' }))
    await waitFor(() => expect(screen.queryByText('Carlos Lima')).toBeNull())

    await act(() => aprovacao.falhar(erroApi(500, 'INTERNAL_ERROR')))

    expect(await screen.findByText('Carlos Lima')).toBeOnTheScreen()
    expect(toast.erro).toHaveBeenCalledWith('mensagem de INTERNAL_ERROR')
  })

  it.each([
    ['SOLICITACAO_CANCELADA', 'O atleta cancelou esta solicitação'],
    ['SOLICITACAO_JA_AVALIADA', 'Esta solicitação já foi avaliada por outro membro da diretoria'],
  ])(
    '409 %s: mensagem do Painel e lista atualizada (critérios 13 e 14)',
    async (code, mensagem) => {
      api.aprovarSolicitacao.mockRejectedValue(erroApi(409, code))
      await abrir()
      pendentes = [ANA]

      await fireEvent.press(screen.getByRole('button', { name: 'Aceitar Carlos Lima' }))

      await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(mensagem))
      expect(toast.erro).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('tab', { name: 'Pendentes (1)' })).toBeOnTheScreen()
      expect(screen.queryByText('Carlos Lima')).toBeNull()
    },
  )

  it('histórico: encerradas por padrão, filtro por status e avaliador (critério 17)', async () => {
    await abrir()

    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }))

    expect(await screen.findByText('Bruno Reis')).toBeOnTheScreen()
    expect(screen.getByText('Rejeitada')).toBeOnTheScreen()
    expect(screen.getByText('Encerrada em 30/09/2026 15:30')).toBeOnTheScreen()
    expect(screen.getByText('por Maria Diretora')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Aceitar Bruno Reis' })).toBeNull()
    expect(api.listarSolicitacoes).toHaveBeenLastCalledWith(
      { status: ['APROVADA', 'REJEITADA', 'CANCELADA'], timeId: undefined },
      1,
      expect.anything(),
    )

    await fireEvent.press(screen.getByRole('radio', { name: 'Rejeitadas' }))
    await waitFor(() =>
      expect(api.listarSolicitacoes).toHaveBeenLastCalledWith(
        { status: ['REJEITADA'], timeId: undefined },
        1,
        expect.anything(),
      ),
    )
  })

  it('filtro por time (times próprios) vale para a lista; o total segue o da atlética', async () => {
    await abrir()

    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei Feminino' }))

    await waitFor(() =>
      expect(api.listarSolicitacoes).toHaveBeenCalledWith(
        { status: ['PENDENTE'], timeId: 't-fem' },
        1,
        expect.anything(),
      ),
    )
    expect(api.listarSolicitacoes).not.toHaveBeenCalledWith(
      expect.objectContaining({ timeId: 't-fem' }),
      1,
      expect.anything(),
      1,
    )
    expect(screen.getByRole('tab', { name: 'Pendentes (2)' })).toBeOnTheScreen()
  })

  it.each([
    ['Pendentes', 'Nenhuma solicitação pendente'],
    ['Histórico', 'Nenhuma solicitação no histórico'],
  ])('vazio em %s', async (aba, mensagem) => {
    api.listarSolicitacoes.mockResolvedValue(pagina([]))
    await render(
      <QueryClientProvider client={cliente}>
        <PainelSolicitacoes />
      </QueryClientProvider>,
    )
    await fireEvent.press(await screen.findByRole('tab', { name: new RegExp(aba) }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
  })

  it('offline: aceitar e rejeitar desabilitados (critério 18)', async () => {
    await abrir()

    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: 'Aceitar Carlos Lima' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rejeitar Carlos Lima' })).toBeDisabled()
    expect(api.aprovarSolicitacao).not.toHaveBeenCalled()
  })
})
