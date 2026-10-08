import type {
  MinhaSituacaoDto,
  SaidaTimeDto,
  SolicitacaoDto,
  TimeDetalheDto,
} from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import * as apiEventos from '@/features/eventos/api'
import * as apiSolicitacoes from '@/features/solicitacoes/api'
import { TelaTime } from '@/features/times'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'
import { eventoResumo, paginaEventos } from '../test-utils/eventos'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/times/api')
jest.mock('@/features/solicitacoes/api')
jest.mock('@/features/eventos/api')

const apiTime = jest.mocked(apiTimes)
const api = jest.mocked(apiSolicitacoes)

const SOLICITACAO_ID = 's1s1s1s1-0000-4000-8000-000000000001'
const NENHUMA: MinhaSituacaoDto = { membro: false, solicitacaoPendente: null }
const PENDENTE: MinhaSituacaoDto = {
  membro: false,
  solicitacaoPendente: { id: SOLICITACAO_ID, criadaEm: '2026-09-30T14:00:00.000Z' },
}
const MEMBRO: MinhaSituacaoDto = { membro: true, solicitacaoPendente: null }
const EU = 'u-eu'

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

async function abrirTime(
  situacao: MinhaSituacaoDto | null,
  aoVoltar = jest.fn(),
  detalhe: Partial<TimeDetalheDto> = {},
) {
  apiTime.buscarTime.mockResolvedValue({ ...time(situacao), ...detalhe })
  await render(
    <QueryClientProvider client={cliente}>
      <TelaTime
        timeId="t-masc"
        aoVoltar={aoVoltar}
        aoAbrirEvento={jest.fn()}
        aoVerAgenda={jest.fn()}
      />
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
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: EU,
      nome: 'Ana',
      email: 'a@x.com',
      fotoUrl: null,
      papel: 'ATLETA',
      atleticaId: 'a1',
    },
  })
  apiTime.buscarElenco.mockResolvedValue({ items: [], total: 0 })
  jest.mocked(apiEventos.listarEventos).mockResolvedValue(paginaEventos([]))
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

describe('Sair do time (#34)', () => {
  const SAIDA: SaidaTimeDto = {
    timeId: 't-masc',
    saidaEm: '2026-11-02T18:30:00.000Z',
    capitaniaRemovida: false,
    participacoesRemovidas: 0,
  }
  const AVISO_BASE =
    'Sair do Futsal Masculino? Para voltar, será preciso enviar uma nova solicitação.'

  it('só o membro vê o botão', async () => {
    await abrirTime(NENHUMA)
    expect(screen.queryByRole('button', { name: 'Sair do time' })).toBeNull()
  })

  it('confirma, carrega, mostra o toast, invalida as chaves e volta a "Solicitar entrada" (critérios 1 e 14)', async () => {
    let concluir: (valor: SaidaTimeDto) => void = () => undefined
    apiTime.sairDoTime.mockReturnValue(new Promise((resolver) => (concluir = resolver)))
    const invalidar = jest.spyOn(cliente, 'invalidateQueries')
    await abrirTime(MEMBRO)

    await fireEvent.press(botao('Sair do time'))
    expect(ultimoAlerta()?.[1]).toBe(AVISO_BASE)
    apiTime.buscarTime.mockResolvedValue(time(NENHUMA))
    await tocarNoAlerta('Sair')

    expect(apiTime.sairDoTime).toHaveBeenCalledWith('t-masc')
    expect(await screen.findByTestId('botao-spinner')).toBeOnTheScreen()
    expect(botao('Sair do time')).toBeDisabled()

    await act(() => concluir(SAIDA))

    expect(toast.sucesso).toHaveBeenCalledWith('Você saiu do time')
    expect(await screen.findByRole('button', { name: 'Solicitar entrada' })).toBeOnTheScreen()
    const chavesInvalidadas = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey)
    expect(chavesInvalidadas).toEqual(
      expect.arrayContaining([chaves.times.todos(), chaves.me(), chaves.eventos.todos()]),
    )
  })

  it('capitão com confirmação futura: o diálogo traz os dois avisos (critério 2)', async () => {
    jest.mocked(apiEventos.listarEventos).mockResolvedValue(
      paginaEventos([
        eventoResumo('e1', {
          minhaParticipacao: { confirmado: true, respondidoEm: SAIDA.saidaEm },
        }),
      ]),
    )
    await abrirTime(MEMBRO, jest.fn(), { capitao: { id: EU, nome: 'Ana' } })

    await waitFor(() => expect(apiEventos.listarEventos).toHaveBeenCalledTimes(2))
    await fireEvent.press(botao('Sair do time'))
    expect(ultimoAlerta()?.[1]).toBe(
      `${AVISO_BASE} Você é o capitão; o time ficará sem capitão. ` +
        'Suas confirmações nos próximos eventos deste time serão removidas.',
    )
  })

  it('cancelar o diálogo não chama a API (critério 12)', async () => {
    await abrirTime(MEMBRO)
    await fireEvent.press(botao('Sair do time'))
    await tocarNoAlerta('Cancelar')
    expect(apiTime.sairDoTime).not.toHaveBeenCalled()
  })

  it('409 NAO_E_MEMBRO: recarrega a tela sem toast de erro (critério 9)', async () => {
    apiTime.sairDoTime.mockRejectedValue(erroApi(409, 'NAO_E_MEMBRO'))
    await abrirTime(MEMBRO)

    await fireEvent.press(botao('Sair do time'))
    apiTime.buscarTime.mockResolvedValue(time(NENHUMA))
    await tocarNoAlerta('Sair')

    expect(await screen.findByRole('button', { name: 'Solicitar entrada' })).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('422: toast com a mensagem da API', async () => {
    apiTime.sairDoTime.mockRejectedValue(erroApi(422, 'TIME_ADVERSARIO'))
    await abrirTime(MEMBRO)

    await fireEvent.press(botao('Sair do time'))
    await tocarNoAlerta('Sair')

    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith('mensagem de TIME_ADVERSARIO'))
  })

  it('falha de rede: toast próprio', async () => {
    apiTime.sairDoTime.mockRejectedValue(erroApi(0, 'SEM_CONEXAO'))
    await abrirTime(MEMBRO)

    await fireEvent.press(botao('Sair do time'))
    await tocarNoAlerta('Sair')

    await waitFor(() =>
      expect(toast.erro).toHaveBeenCalledWith('Não foi possível sair do time. Tente novamente.'),
    )
    expect(toast.erro).toHaveBeenCalledTimes(1)
  })

  it('offline: "Sair do time" desabilitado (critério 13)', async () => {
    await abrirTime(MEMBRO)
    await act(() => onlineManager.setOnline(false))
    await waitFor(() => expect(botao('Sair do time')).toBeDisabled())
  })
})
