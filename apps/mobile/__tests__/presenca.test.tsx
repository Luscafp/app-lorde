import type { AtleticaPublica, EventoDetalheDto, ListaPresencaDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import EventoPainel from '../app/(app)/(abas)/painel/eventos/[id]/index'
import PresencaEvento from '../app/(app)/(abas)/painel/eventos/[id]/presenca'
import { toast } from '@/components/ui/toast'
import * as apiEventos from '@/features/eventos/api'
import * as apiParticipacoes from '@/features/participacoes/api'
import { MENSAGEM_PRESENCA_BLOQUEADA } from '@/features/participacoes'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/eventos/api')
jest.mock('@/features/participacoes/api')
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f' }),
  useNavigation: () => ({ addListener: () => () => undefined, dispatch: jest.fn() }),
}))

const eventos = jest.mocked(apiEventos)
const participacoes = jest.mocked(apiParticipacoes)
const { router } = jest.requireMock<typeof import('expo-router')>('expo-router')

const ID = '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'
const ANA = 'c1c1c1c1-0000-4000-8000-000000000001'
const BIA = 'c1c1c1c1-0000-4000-8000-000000000002'
const CAIO = 'c1c1c1c1-0000-4000-8000-000000000003'

const CASA: AtleticaPublica = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  nome: 'Atlética da Casa',
  sigla: 'CASA',
  curso: null,
  logoUrl: null,
  corPrimaria: '#1E3A8A',
  corSecundaria: '#F59E0B',
  contatoEmail: null,
  contatoInstagram: null,
  contatoWhatsapp: null,
}

const EVENTO: EventoDetalheDto = {
  id: ID,
  tipo: 'TREINO',
  status: 'EM_ANDAMENTO',
  inicio: '2026-09-20T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  observacoes: null,
  serieId: null,
  time: { id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', nome: 'Vôlei Masculino' },
  modalidade: { id: '7a2d3b8f-3a6c-4d4a-8b1f-4a4c2c9e3d22', nome: 'Vôlei', icone: 'volleyball' },
  timeAdversario: null,
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  criadoEm: '2026-09-01T14:00:00.000Z',
  atualizadoEm: '2026-09-01T14:00:00.000Z',
  serie: null,
  contagem: { confirmados: 2, recusados: 1, semResposta: 0, elenco: 3 },
  confirmados: [],
  souMembro: false,
  minhaParticipacao: null,
  podeResponder: false,
  motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
}

const LISTA: ListaPresencaDto = {
  eventoId: ID,
  status: 'EM_ANDAMENTO',
  registrada: false,
  registradaEm: null,
  itens: [
    { usuarioId: ANA, nome: 'Ana Souza', fotoUrl: null, resposta: 'CONFIRMOU', presente: true },
    { usuarioId: BIA, nome: 'Bia Reis', fotoUrl: null, resposta: 'CONFIRMOU', presente: true },
    { usuarioId: CAIO, nome: 'Caio Lima', fotoUrl: null, resposta: 'RECUSOU', presente: false },
  ],
}

const REGISTRADA: ListaPresencaDto = {
  ...LISTA,
  registrada: true,
  registradaEm: '2026-09-20T23:00:00.000Z',
}

let cliente: QueryClient

function renderizar(elemento: ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

const caixa = (nome: string) => screen.getByRole('checkbox', { name: nome })
const botao = (nome: string) => screen.getByRole('button', { name: nome })

beforeEach(() => {
  jest.clearAllMocks()
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: 'u1',
      nome: 'Diretor',
      email: 'd@x.com',
      fotoUrl: null,
      papel: 'DIRETOR',
      atleticaId: CASA.id,
    },
  })
  cliente.setQueryData(chaves.atletica(), CASA)
  eventos.buscarEvento.mockResolvedValue(EVENTO)
  participacoes.listarPresencas.mockResolvedValue(LISTA)
})

afterEach(() => {
  cliente.clear()
})

describe('detalhe do evento no Painel', () => {
  it.each(['AGENDADO', 'CANCELADO'] as const)(
    '%s: "Registrar presença" desabilitado com a explicação, sem consultar a lista',
    async (status) => {
      eventos.buscarEvento.mockResolvedValue({ ...EVENTO, status })
      await renderizar(<EventoPainel />)

      expect(await screen.findByRole('button', { name: 'Registrar presença' })).toBeDisabled()
      expect(screen.getByText(MENSAGEM_PRESENCA_BLOQUEADA)).toBeOnTheScreen()
      expect(participacoes.listarPresencas).not.toHaveBeenCalled()
    },
  )

  it('EM_ANDAMENTO sem registro: botão habilitado abre a tela de presença', async () => {
    await renderizar(<EventoPainel />)

    const registrar = await screen.findByRole('button', { name: 'Registrar presença' })
    expect(registrar).toBeEnabled()
    await fireEvent.press(registrar)
    expect(router.push).toHaveBeenCalledWith(`/painel/eventos/${ID}/presenca`)
  })

  it('com presença registrada: resumo "Presença registrada · N presentes" e "Corrigir presença"', async () => {
    participacoes.listarPresencas.mockResolvedValue(REGISTRADA)
    eventos.buscarEvento.mockResolvedValue({ ...EVENTO, status: 'FINALIZADO' })
    await renderizar(<EventoPainel />)

    expect(await screen.findByText('Presença registrada · 2 presentes')).toBeOnTheScreen()
    expect(botao('Corrigir presença')).toBeEnabled()
  })
})

describe('tela de presença', () => {
  it('pré-preenchida: confirmados marcados, etiquetas de resposta e contador', async () => {
    await renderizar(<PresencaEvento />)

    expect(await screen.findByText('2 de 3 presentes')).toBeOnTheScreen()
    expect(caixa('Ana Souza')).toBeChecked()
    expect(caixa('Bia Reis')).toBeChecked()
    expect(caixa('Caio Lima')).not.toBeChecked()
    expect(screen.getAllByText('Confirmou')).toHaveLength(2)
    expect(screen.getByText('Recusou')).toBeOnTheScreen()
    expect(await screen.findByText('Treino — Vôlei Masculino')).toBeOnTheScreen()
  })

  it('checkbox alterna e atualiza o contador', async () => {
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')

    await fireEvent.press(caixa('Caio Lima'))
    expect(caixa('Caio Lima')).toBeChecked()
    expect(screen.getByText('3 de 3 presentes')).toBeOnTheScreen()

    await fireEvent.press(caixa('Ana Souza'))
    expect(caixa('Ana Souza')).not.toBeChecked()
    expect(screen.getByText('2 de 3 presentes')).toBeOnTheScreen()
  })

  it('"Marcar todos" e "Desmarcar todos"', async () => {
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')

    await fireEvent.press(botao('Marcar todos'))
    expect(screen.getByText('3 de 3 presentes')).toBeOnTheScreen()
    expect(caixa('Caio Lima')).toBeChecked()

    await fireEvent.press(botao('Desmarcar todos'))
    expect(screen.getByText('0 de 3 presentes')).toBeOnTheScreen()
    expect(caixa('Ana Souza')).not.toBeChecked()
  })

  it('chamada já registrada: "Salvar presenças" desabilitado até haver mudança', async () => {
    participacoes.listarPresencas.mockResolvedValue(REGISTRADA)
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')

    expect(botao('Salvar presenças')).toBeDisabled()
    await fireEvent.press(caixa('Caio Lima'))
    expect(botao('Salvar presenças')).toBeEnabled()
    await fireEvent.press(caixa('Caio Lima'))
    expect(botao('Salvar presenças')).toBeDisabled()
  })

  it('primeira chamada: a lista pré-preenchida já pode ser salva', async () => {
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')
    expect(botao('Salvar presenças')).toBeEnabled()
  })

  it('salvar envia os marcados, mostra "Presenças salvas" e volta', async () => {
    participacoes.registrarPresencas.mockResolvedValue({
      ...REGISTRADA,
      itens: REGISTRADA.itens.map((item) => ({ ...item, presente: item.usuarioId !== ANA })),
    })
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')

    await fireEvent.press(caixa('Ana Souza'))
    await fireEvent.press(caixa('Caio Lima'))
    await fireEvent.press(botao('Salvar presenças'))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Presenças salvas'))
    expect(participacoes.registrarPresencas).toHaveBeenCalledWith(ID, {
      presentes: [BIA, CAIO],
    })
    expect(router.back).toHaveBeenCalled()
  })

  it('422 da API: mostra a mensagem e relê a lista', async () => {
    const mensagem = 'A presença só pode ser registrada em eventos em andamento ou finalizados.'
    participacoes.registrarPresencas.mockRejectedValue(
      new ApiErro({ status: 422, code: 'EVENTO_STATUS_INVALIDO', message: mensagem }),
    )
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')

    await fireEvent.press(botao('Salvar presenças'))

    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(mensagem))
    await waitFor(() => expect(participacoes.listarPresencas).toHaveBeenCalledTimes(2))
    expect(router.back).not.toHaveBeenCalled()
  })

  it('offline: botão desabilitado, aviso de sem conexão e nenhuma requisição', async () => {
    await renderizar(<PresencaEvento />)
    await screen.findByText('2 de 3 presentes')
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
    expect(botao('Salvar presenças')).toBeDisabled()
    await fireEvent.press(botao('Salvar presenças'))
    expect(participacoes.registrarPresencas).not.toHaveBeenCalled()
  })

  it('evento agendado (link direto): explica que a presença não pode ser registrada', async () => {
    participacoes.listarPresencas.mockResolvedValue({ ...LISTA, status: 'AGENDADO' })
    await renderizar(<PresencaEvento />)
    expect(await screen.findByText(MENSAGEM_PRESENCA_BLOQUEADA)).toBeOnTheScreen()
  })
})
