import type { EventoDetalheDto, SerieCriadaDto, TimeDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import EditarEvento from '../app/(app)/(abas)/painel/eventos/[id]/editar'
import EventoPainel from '../app/(app)/(abas)/painel/eventos/[id]/index'
import { toast } from '@/components/ui/toast'
import { EventoForm } from '@/features/eventos'
import * as apiEventos from '@/features/eventos/api'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

const ID = '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'
const SERIE = '5f2c8d1e-3a4b-4c5d-8e6f-7a8b9c0d1e2f'

let mockParametros: Record<string, string> = { id: ID }

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/eventos/api')
jest.mock('@/features/times/api')
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParametros,
}))

const eventos = jest.mocked(apiEventos)
const times = jest.mocked(apiTimes)
const { router } = jest.requireMock<typeof import('expo-router')>('expo-router')

const AGORA = Date.parse('2026-10-01T12:00:00.000Z')
const VOLEI = { id: '7a2d3b8f-3a6c-4d4a-8b1f-4a4c2c9e3d22', nome: 'Vôlei', icone: 'volleyball' }

const VOLEI_CASA: TimeDto = {
  id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  nome: 'Vôlei Masculino',
  ativo: true,
  modalidade: VOLEI,
  atletica: {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    nome: 'Casa',
    sigla: null,
    propria: true,
  },
  capitao: null,
  totalMembros: 10,
}

const TREINO: EventoDetalheDto = {
  id: ID,
  tipo: 'TREINO',
  status: 'AGENDADO',
  inicio: '2026-10-26T21:30:00.000Z',
  local: 'Quadra 1',
  observacoes: null,
  serieId: SERIE,
  time: { id: VOLEI_CASA.id, nome: VOLEI_CASA.nome },
  modalidade: VOLEI,
  timeAdversario: null,
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  criadoEm: '2026-09-30T14:00:00.000Z',
  atualizadoEm: '2026-09-30T14:00:00.000Z',
  serie: {
    id: SERIE,
    diasSemana: [1],
    horario: '18:30',
    dataInicio: '2026-10-05',
    dataFim: '2026-12-07',
  },
  contagem: { confirmados: 0, recusados: 0, semResposta: 10, elenco: 10 },
  confirmados: [],
  souMembro: false,
  minhaParticipacao: null,
  podeResponder: false,
  motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
}

const SERIE_CRIADA: SerieCriadaDto = {
  serie: {
    id: SERIE,
    timeId: VOLEI_CASA.id,
    diasSemana: [1, 3],
    horario: '18:30',
    dataInicio: '2026-10-05',
    dataFim: '2027-04-05',
  },
  totalOcorrencias: 53,
  primeiraOcorrencia: { id: ID, inicio: '2026-10-05T21:30:00.000Z' },
  ultimaOcorrencia: {
    id: 'e7b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    inicio: '2027-04-05T21:30:00.000Z',
  },
}

const PREVIA = '53 treinos · primeiro em seg, 05/10/2026 18:30 · último em seg, 05/04/2027 18:30'

let cliente: QueryClient

function renderizar(elemento: ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

async function confirmarAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

const salvar = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

async function preencherTreinoRecorrente() {
  await fireEvent.press(screen.getByRole('radio', { name: 'Treino' }))
  await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei Masculino' }))
  await fireEvent.changeText(screen.getByLabelText('Data'), '05102026')
  await fireEvent.changeText(screen.getByLabelText('Horário'), '1830')
  await fireEvent.changeText(screen.getByLabelText('Local'), 'Quadra do CCET')
  await fireEvent(screen.getByLabelText('Treino recorrente'), 'valueChange', true)
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Segunda' }))
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Quarta' }))
  await fireEvent.changeText(screen.getByLabelText('Repetir até'), '05042027')
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(AGORA)
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  mockParametros = { id: ID }
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: 'u1',
      nome: 'Ana',
      email: 'a@x.com',
      fotoUrl: null,
      papel: 'DIRETOR',
      atleticaId: 'a1',
    },
  })
  times.listarTimes.mockResolvedValue({ items: [VOLEI_CASA], page: 1, limit: 20, total: 1 })
  eventos.buscarEvento.mockResolvedValue(TREINO)
  eventos.contarAgendadosDaSerie.mockResolvedValue(7)
})

afterEach(() => {
  cliente.clear()
  jest.restoreAllMocks()
})

describe('Criação de treino recorrente', () => {
  it('o switch só aparece para Treino na criação, desligado por padrão', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    expect(screen.queryByLabelText('Treino recorrente')).toBeNull()

    await fireEvent.press(screen.getByRole('radio', { name: 'Treino' }))
    expect(screen.getByLabelText('Treino recorrente')).toHaveProp('value', false)
    expect(screen.queryByLabelText('Repetir até')).toBeNull()
  })

  it('mostra a prévia com total, primeira e última data antes de salvar (critério 18)', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherTreinoRecorrente()

    expect(screen.getByLabelText('Data de início')).toHaveDisplayValue('05/10/2026')
    expect(screen.getByText(PREVIA)).toBeOnTheScreen()
    expect(screen.getByText('No máximo 6 meses: até 05/04/2027')).toBeOnTheScreen()
  })

  it('a prévia acompanha os dias; sem datas, avisa e desabilita Salvar', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherTreinoRecorrente()
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Quarta' }))
    expect(screen.getByText(/^27 treinos · /)).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Repetir até'), '05102026')
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Segunda' }))
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Terça' }))
    expect(screen.getByText('Nenhuma data corresponde aos dias escolhidos')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('salva a série, avisa o total e abre a primeira ocorrência', async () => {
    eventos.criarSerie.mockResolvedValue(SERIE_CRIADA)
    const aoSalvar = jest.fn()
    await renderizar(<EventoForm aoSalvar={aoSalvar} />)
    await preencherTreinoRecorrente()
    await salvar()

    await waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(ID))
    expect(eventos.criarSerie).toHaveBeenCalledWith({
      tipo: 'TREINO',
      timeId: VOLEI_CASA.id,
      local: 'Quadra do CCET',
      observacoes: null,
      recorrencia: {
        dataInicio: '2026-10-05',
        horario: '18:30',
        diasSemana: [1, 3],
        dataFim: '2027-04-05',
      },
    })
    expect(eventos.criarEvento).not.toHaveBeenCalled()
    expect(toast.sucesso).toHaveBeenCalledWith('53 treinos criados')
  })

  it('valida dias e o limite de 6 meses no campo', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherTreinoRecorrente()
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Segunda' }))
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Quarta' }))
    await fireEvent.changeText(screen.getByLabelText('Repetir até'), '06042027')
    await salvar()

    expect(await screen.findByText('Escolha ao menos um dia da semana.')).toBeOnTheScreen()
    expect(screen.getByText('A série pode ter no máximo 6 meses.')).toBeOnTheScreen()
    expect(eventos.criarSerie).not.toHaveBeenCalled()
  })

  it('erro da API em recorrencia.dataFim aparece em "Repetir até"', async () => {
    const message = 'A série pode ter no máximo 6 meses.'
    eventos.criarSerie.mockRejectedValue(
      new ApiErro({
        status: 400,
        code: 'VALIDATION_ERROR',
        message,
        details: [{ field: 'recorrencia.dataFim', message }],
      }),
    )
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherTreinoRecorrente()
    await salvar()

    expect(await screen.findByText(message)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
  })
})

describe('Ocorrência de série no Painel', () => {
  it('mostra o selo Recorrente', async () => {
    await renderizar(<EventoPainel />)
    expect(await screen.findByText('↺ Recorrente')).toBeOnTheScreen()
  })

  it('Editar pergunta o escopo e "Este e os seguintes" abre o formulário restrito (critério 19)', async () => {
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('button', { name: 'Somente este treino' })).toBeOnTheScreen()
    expect(await screen.findByText('7 treinos agendados a partir deste.')).toBeOnTheScreen()
    expect(eventos.contarAgendadosDaSerie).toHaveBeenCalledWith(
      SERIE,
      TREINO.inicio,
      expect.anything(),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Este e os seguintes' }))
    expect(router.push).toHaveBeenCalledWith(`/painel/eventos/${ID}/editar?escopo=ESTA_E_SEGUINTES`)
  })

  it('"Somente este treino" segue a edição avulsa', async () => {
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Somente este treino' }))
    expect(router.push).toHaveBeenCalledWith(`/painel/eventos/${ID}/editar`)
  })

  it('Cancelar "Este e os seguintes" confirma com o total e cancela em lote', async () => {
    eventos.cancelarEvento.mockResolvedValue({ eventoIds: [ID, SERIE], status: 'CANCELADO' })
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar evento' }))
    await screen.findByText('7 treinos agendados a partir deste.')
    await fireEvent.press(screen.getByRole('button', { name: 'Este e os seguintes' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancelar treinos?',
      '7 treinos agendados serão cancelados e continuarão visíveis como Cancelado até a data.',
      expect.any(Array),
    )
    await confirmarAlerta('Cancelar treinos')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('2 treinos cancelados'))
    expect(eventos.cancelarEvento).toHaveBeenCalledWith(ID, 'ESTA_E_SEGUINTES')
  })

  it('sem a contagem, a confirmação omite o número', async () => {
    eventos.contarAgendadosDaSerie.mockRejectedValue(new Error('falhou'))
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar evento' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Este e os seguintes' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancelar treinos?',
      'Os treinos agendados a partir deste serão cancelados e continuarão visíveis como Cancelado até a data.',
      expect.any(Array),
    )
  })

  it('evento avulso não pergunta o escopo', async () => {
    eventos.buscarEvento.mockResolvedValue({ ...TREINO, serieId: null, serie: null })
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar' }))

    expect(screen.queryByRole('button', { name: 'Este e os seguintes' })).toBeNull()
    expect(router.push).toHaveBeenCalledWith(`/painel/eventos/${ID}/editar`)
  })
})

describe('Edição "Este e os seguintes"', () => {
  beforeEach(() => {
    mockParametros = { id: ID, escopo: 'ESTA_E_SEGUINTES' }
  })

  it('trava Data e Time, avisa e envia só horário, local e observações', async () => {
    eventos.editarSeguintes.mockResolvedValue({
      eventoIds: [ID],
      serieId: SERIE,
      serieDividida: true,
    })
    await renderizar(<EditarEvento />)

    expect(
      await screen.findByText(
        'Treinos deste em diante que você alterou individualmente também receberão estas mudanças.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText('Data')).toHaveProp('editable', false)
    expect(await screen.findByRole('radio', { name: 'Vôlei Masculino' })).toBeDisabled()
    expect(screen.getByLabelText('Horário')).not.toHaveProp('editable', false)

    await fireEvent.changeText(screen.getByLabelText('Horário'), '1900')
    await fireEvent.changeText(screen.getByLabelText('Local'), 'Quadra 2')
    await salvar()

    await waitFor(() =>
      expect(eventos.editarSeguintes).toHaveBeenCalledWith(ID, {
        escopo: 'ESTA_E_SEGUINTES',
        horario: '19:00',
        local: 'Quadra 2',
      }),
    )
    expect(eventos.atualizarEvento).not.toHaveBeenCalled()
    expect(toast.sucesso).toHaveBeenCalledWith('Treinos atualizados')
    expect(router.back).toHaveBeenCalled()
  })

  it('sem mudanças volta sem chamar a API', async () => {
    await renderizar(<EditarEvento />)
    await screen.findByLabelText('Local')
    await salvar()

    await waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(eventos.editarSeguintes).not.toHaveBeenCalled()
  })
})
