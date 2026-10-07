import type { MinhaSituacaoDto, SolicitacaoDto, TimeDetalheDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import * as apiSolicitacoes from '@/features/solicitacoes/api'
import { TelaTime } from '@/features/times'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/times/api')
jest.mock('@/features/solicitacoes/api')

const apiTime = jest.mocked(apiTimes)
const api = jest.mocked(apiSolicitacoes)

const SOLICITACAO_ID = 's1s1s1s1-0000-4000-8000-000000000001'
const NENHUMA: MinhaSituacaoDto = { membro: false, solicitacaoPendente: null }
const PENDENTE: MinhaSituacaoDto = {
  membro: false,
  solicitacaoPendente: { id: SOLICITACAO_ID, criadaEm: '2026-09-30T14:00:00.000Z' },
}
const MEMBRO: MinhaSituacaoDto = { membro: true, solicitacaoPendente: null }

const time = (minhaSituacao: MinhaSituacaoDto | null): TimeDetalheDto => ({
  id: 't-masc',
  nome: 'Futsal Masculino',
  ativo: true,
  modalidade: { id: 'm-futsal', nome: 'Futsal', icone: 'soccer' },
  atletica: { id: 'a1', nome: 'Lorde', sigla: 'LRD', propria: minhaSituacao !== null },
  capitao: null,
  totalMembros: 0,
  minhaSituacao,
})

const solicitacao = (status: SolicitacaoDto['status']): SolicitacaoDto => ({
  id: SOLICITACAO_ID,
  timeId: 't-masc',
  status,
  criadaEm: '2026-09-30T14:00:00.000Z',
  canceladaEm: status === 'CANCELADA' ? '2026-09-30T15:00:00.000Z' : null,
})

const erroApi = (status: number, code: string) =>
  new ApiErro({ status, code, message: `mensagem de ${code}` })

let cliente: QueryClient

async function abrirTime(situacao: MinhaSituacaoDto | null, aoVoltar = jest.fn()) {
  apiTime.buscarTime.mockResolvedValue(time(situacao))
  await render(
    <QueryClientProvider client={cliente}>
      <TelaTime timeId="t-masc" aoVoltar={aoVoltar} />
    </QueryClientProvider>,
  )
  await screen.findByRole('header', { name: 'Futsal Masculino' })
  return aoVoltar
}

const ultimoAlerta = () => jest.mocked(Alert.alert).mock.lastCall

async function tocarNoAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = ultimoAlerta()?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

const botao = (nome: string) => screen.getByRole('button', { name: nome })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  apiTime.buscarElenco.mockResolvedValue({ items: [], total: 0 })
})

afterEach(() => cliente.clear())

describe('AcaoEntradaTime', () => {
  it('membro: faixa "Você faz parte deste time", sem botão de solicitar (critério 4)', async () => {
    await abrirTime(MEMBRO)

    expect(screen.getByText('Você faz parte deste time')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Solicitar entrada' })).toBeNull()
  })

  it('time adversário: nada é exibido', async () => {
    await abrirTime(null)
    expect(screen.queryByTestId('acao-entrada-time')).toBeNull()
  })

  it('solicitar: confirmação, carregamento imediato, toast e recarga (critério 1)', async () => {
    let concluir: (valor: SolicitacaoDto) => void = () => undefined
    api.solicitarEntrada.mockReturnValue(new Promise((resolver) => (concluir = resolver)))
    await abrirTime(NENHUMA)

    await fireEvent.press(botao('Solicitar entrada'))
    expect(ultimoAlerta()?.[1]).toBe(
      'Enviar uma solicitação para entrar no Futsal Masculino? A diretoria vai aceitar ou rejeitar.',
    )
    expect(api.solicitarEntrada).not.toHaveBeenCalled()
    apiTime.buscarTime.mockResolvedValue(time(PENDENTE))
    await tocarNoAlerta('Enviar')

    expect(api.solicitarEntrada).toHaveBeenCalledWith('t-masc')
    expect(await screen.findByTestId('botao-spinner')).toBeOnTheScreen()
    expect(botao('Solicitar entrada')).toBeDisabled()

    await act(() => concluir(solicitacao('PENDENTE')))

    expect(toast.sucesso).toHaveBeenCalledWith('Solicitação enviada — aguarde a diretoria')
    expect(await screen.findByText('Solicitação pendente de aprovação')).toBeOnTheScreen()
    expect(botao('Cancelar solicitação')).toBeOnTheScreen()
  })

  it('cancelar: confirmação, toast e volta a "Solicitar entrada" (critério 6)', async () => {
    api.cancelarSolicitacao.mockResolvedValue(solicitacao('CANCELADA'))
    await abrirTime(PENDENTE)

    await fireEvent.press(botao('Cancelar solicitação'))
    expect(ultimoAlerta()?.[1]).toBe('Deseja cancelar sua solicitação de entrada neste time?')
    apiTime.buscarTime.mockResolvedValue(time(NENHUMA))
    await tocarNoAlerta('Cancelar solicitação')

    expect(api.cancelarSolicitacao).toHaveBeenCalledWith(SOLICITACAO_ID)
    expect(toast.sucesso).toHaveBeenCalledWith('Solicitação cancelada')
    expect(await screen.findByRole('button', { name: 'Solicitar entrada' })).toBeOnTheScreen()
  })

  it('desistir na confirmação não envia nada', async () => {
    await abrirTime(PENDENTE)
    await fireEvent.press(botao('Cancelar solicitação'))
    await tocarNoAlerta('Voltar')
    expect(api.cancelarSolicitacao).not.toHaveBeenCalled()
  })

  it('409 SOLICITACAO_JA_AVALIADA: toast da API e recarrega a situação (critério 8)', async () => {
    api.cancelarSolicitacao.mockRejectedValue(erroApi(409, 'SOLICITACAO_JA_AVALIADA'))
    await abrirTime(PENDENTE)

    await fireEvent.press(botao('Cancelar solicitação'))
    apiTime.buscarTime.mockResolvedValue(time(MEMBRO))
    await tocarNoAlerta('Cancelar solicitação')

    await waitFor(() =>
      expect(toast.erro).toHaveBeenCalledWith('mensagem de SOLICITACAO_JA_AVALIADA'),
    )
    expect(await screen.findByText('Você faz parte deste time')).toBeOnTheScreen()
  })

  it.each(['SOLICITACAO_PENDENTE', 'JA_E_MEMBRO'])(
    '409 %s ao solicitar: toast da API e recarrega',
    async (code) => {
      api.solicitarEntrada.mockRejectedValue(erroApi(409, code))
      await abrirTime(NENHUMA)

      await fireEvent.press(botao('Solicitar entrada'))
      await tocarNoAlerta('Enviar')

      await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(`mensagem de ${code}`))
      await waitFor(() => expect(apiTime.buscarTime).toHaveBeenCalledTimes(2))
    },
  )

  it('422 TIME_INATIVO: toast e volta para a lista de times', async () => {
    api.solicitarEntrada.mockRejectedValue(erroApi(422, 'TIME_INATIVO'))
    const aoVoltar = await abrirTime(NENHUMA)

    await fireEvent.press(botao('Solicitar entrada'))
    await tocarNoAlerta('Enviar')

    await waitFor(() => expect(aoVoltar).toHaveBeenCalled())
    expect(toast.erro).toHaveBeenCalledWith('mensagem de TIME_INATIVO')
  })

  it.each([
    ['Solicitar entrada', NENHUMA],
    ['Cancelar solicitação', PENDENTE],
  ] as const)('offline: "%s" desabilitado (critério 18)', async (nome, situacao) => {
    await abrirTime(situacao)
    await act(() => onlineManager.setOnline(false))

    await waitFor(() => expect(botao(nome)).toBeDisabled())
    expect(
      screen.getByText('Sem conexão. Conecte-se à internet para concluir esta ação.'),
    ).toBeOnTheScreen()
  })
})
