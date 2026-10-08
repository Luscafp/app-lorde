import type {
  AtleticaAdversaria,
  EventoDetalheDto,
  Papel,
  StatusEvento,
  TimeDto,
} from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import EditarEvento from '../app/(app)/(abas)/painel/eventos/[id]/editar'
import EventoPainel from '../app/(app)/(abas)/painel/eventos/[id]/index'
import { toast } from '@/components/ui/toast'
import { EventoForm } from '@/features/eventos'
import * as apiEventos from '@/features/eventos/api'
import { paraInicio } from '@/features/eventos/schemas'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/eventos/api')
jest.mock('@/features/times/api')
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f' }),
}))

const eventos = jest.mocked(apiEventos)
const times = jest.mocked(apiTimes)

const AGORA = Date.parse('2026-10-01T12:00:00.000Z')

const VOLEI = { id: '7a2d3b8f-3a6c-4d4a-8b1f-4a4c2c9e3d22', nome: 'Vôlei', icone: 'volleyball' }
const FUTSAL = { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal', icone: 'soccer' }
const PROPRIA = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  nome: 'Atlética da Casa',
  sigla: 'CASA',
  propria: true,
}
const FENIX: AtleticaAdversaria = {
  id: 'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b',
  nome: 'Atlética Fênix',
  sigla: 'FNX',
  curso: null,
  totalTimes: 1,
}

function time(id: string, nome: string, modalidade: typeof VOLEI, adversario = false): TimeDto {
  return {
    id,
    nome,
    ativo: true,
    modalidade,
    atletica: adversario
      ? { id: FENIX.id, nome: FENIX.nome, sigla: FENIX.sigla, propria: false }
      : PROPRIA,
    capitao: null,
    totalMembros: adversario ? 0 : 10,
  }
}

const VOLEI_CASA = time('b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', 'Vôlei Masculino', VOLEI)
const FUTSAL_CASA = time('c3b2a1d4-6f5e-4b7a-9c8d-1e2f3a4b5c6d', 'Futsal Masculino', FUTSAL)
const VOLEI_FENIX = time('d4c3b2a1-6f5e-4b7a-9c8d-5d4c3b2a1f0e', 'Fênix Vôlei', VOLEI, true)
const FUTSAL_FENIX = time('e5d4c3b2-7a6f-4c8b-8d9e-6e5d4c3b2a1f', 'Fênix Futsal', FUTSAL, true)
const NOVO_ADVERSARIO = time('f6e5d4c3-8b7a-4d9c-9e0f-7f6e5d4c3b2a', 'Fênix Vôlei B', VOLEI, true)

const EVENTO: EventoDetalheDto = {
  id: '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f',
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2026-10-10T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  observacoes: null,
  serieId: null,
  time: { id: VOLEI_CASA.id, nome: VOLEI_CASA.nome },
  modalidade: VOLEI,
  timeAdversario: {
    id: VOLEI_FENIX.id,
    nome: VOLEI_FENIX.nome,
    atletica: { id: FENIX.id, nome: FENIX.nome, sigla: FENIX.sigla },
  },
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  criadoEm: '2026-09-30T14:00:00.000Z',
  atualizadoEm: '2026-09-30T14:00:00.000Z',
  serie: null,
  contagem: { confirmados: 0, recusados: 0, semResposta: 10, elenco: 10 },
  confirmados: [],
  souMembro: false,
  minhaParticipacao: null,
  podeResponder: false,
  motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
}

const pagina = <T,>(items: T[]) => ({ items, page: 1, limit: 20, total: items.length })

let cliente: QueryClient

function renderizar(elemento: ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

function comPapel(papel: Papel) {
  useSessao.setState({
    status: 'autenticado',
    usuario: { id: 'u1', nome: 'Ana', email: 'a@x.com', fotoUrl: null, papel, atleticaId: 'a1' },
  })
}

function comStatus(status: StatusEvento) {
  eventos.buscarEvento.mockResolvedValue({ ...EVENTO, status })
}

async function confirmarAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

async function preencherJogoDeVolei() {
  await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei Masculino' }))
  await fireEvent.press(await screen.findByRole('radio', { name: 'Fênix Vôlei · FNX' }))
  await fireEvent.changeText(screen.getByLabelText('Data'), '10102026')
  await fireEvent.changeText(screen.getByLabelText('Horário'), '1900')
  await fireEvent.changeText(screen.getByLabelText('Local'), 'Ginásio Castelinho')
}

const salvar = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(AGORA)
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  comPapel('DIRETOR')
  times.listarTimes.mockImplementation((filtros) =>
    Promise.resolve(
      filtros.escopo === 'ADVERSARIOS'
        ? pagina(
            [VOLEI_FENIX, FUTSAL_FENIX].filter((t) => t.modalidade.id === filtros.modalidadeId),
          )
        : pagina([VOLEI_CASA, FUTSAL_CASA]),
    ),
  )
  times.listarAtleticasAdversarias.mockResolvedValue(pagina([FENIX]))
  eventos.buscarEvento.mockResolvedValue(EVENTO)
})

afterEach(() => {
  cliente.clear()
  jest.restoreAllMocks()
})

describe('paraInicio', () => {
  it('converte data e hora de America/Fortaleza para UTC', () => {
    expect(paraInicio('10/10/2026', '19:00')).toBe('2026-10-10T22:00:00.000Z')
    expect(paraInicio('10/10/2026', '23:30')).toBe('2026-10-11T02:30:00.000Z')
  })

  it.each([
    ['31/02/2026', '19:00'],
    ['10/10/26', '19:00'],
    ['10/10/2026', '24:00'],
  ])('rejeita %s %s', (data, hora) => {
    expect(paraInicio(data, hora)).toBeUndefined()
  })
})

describe('EventoForm', () => {
  it('cadastra Jogo com inicio em UTC, mostrando a modalidade derivada', async () => {
    eventos.criarEvento.mockResolvedValue(EVENTO)
    const aoSalvar = jest.fn()
    await renderizar(<EventoForm aoSalvar={aoSalvar} />)

    await preencherJogoDeVolei()
    expect(screen.getByText('Modalidade: Vôlei')).toBeOnTheScreen()
    expect(screen.getByLabelText('Data')).toHaveDisplayValue('10/10/2026')
    expect(screen.getByLabelText('Horário')).toHaveDisplayValue('19:00')
    await salvar()

    await waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(EVENTO.id))
    expect(eventos.criarEvento).toHaveBeenCalledWith({
      tipo: 'JOGO',
      timeId: VOLEI_CASA.id,
      timeAdversarioId: VOLEI_FENIX.id,
      inicio: '2026-10-10T22:00:00.000Z',
      local: 'Ginásio Castelinho',
      observacoes: null,
    })
    expect(toast.sucesso).toHaveBeenCalledWith('Evento cadastrado')
  })

  it('alternar Jogo/Treino mostra e oculta o adversário', async () => {
    eventos.criarEvento.mockResolvedValue({ ...EVENTO, tipo: 'TREINO', timeAdversario: null })
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherJogoDeVolei()

    await fireEvent.press(screen.getByRole('radio', { name: 'Treino' }))
    expect(screen.queryByText('Adversário')).toBeNull()
    await salvar()
    await waitFor(() => expect(eventos.criarEvento).toHaveBeenCalled())
    expect(eventos.criarEvento.mock.lastCall?.[0]).not.toHaveProperty('timeAdversarioId')

    await fireEvent.press(screen.getByRole('radio', { name: 'Jogo' }))
    expect(screen.getByText('Adversário')).toBeOnTheScreen()
    expect(await screen.findByRole('radio', { name: 'Fênix Vôlei · FNX' })).not.toBeSelected()
  })

  it('trocar o time por um de outra modalidade limpa o adversário', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherJogoDeVolei()

    await fireEvent.press(screen.getByRole('radio', { name: 'Futsal Masculino' }))
    expect(screen.getByText('Modalidade: Futsal')).toBeOnTheScreen()
    expect(await screen.findByRole('radio', { name: 'Fênix Futsal · FNX' })).not.toBeSelected()
    expect(screen.queryByRole('radio', { name: 'Fênix Vôlei · FNX' })).toBeNull()
    await salvar()

    expect(await screen.findByText('Selecione o adversário.')).toBeOnTheScreen()
    expect(eventos.criarEvento).not.toHaveBeenCalled()
  })

  it('mostra os erros do Zod por campo', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await fireEvent.changeText(screen.getByLabelText('Local'), 'G')
    await salvar()

    expect(await screen.findByText('Selecione o time.')).toBeOnTheScreen()
    expect(screen.getByText('Selecione o adversário.')).toBeOnTheScreen()
    expect(screen.getByText('Informe a data (dd/mm/aaaa).')).toBeOnTheScreen()
    expect(screen.getByText('Informe o horário (HH:mm).')).toBeOnTheScreen()
    expect(screen.getByText('Informe o local (mín. 2 caracteres).')).toBeOnTheScreen()
    expect(eventos.criarEvento).not.toHaveBeenCalled()
  })

  it.each([
    [
      'VALIDATION_ERROR sem adversário (critério 3)',
      400,
      'VALIDATION_ERROR',
      'timeAdversarioId',
      'Selecione o adversário.',
    ],
    [
      'MODALIDADES_DIFERENTES (critério 4)',
      422,
      'MODALIDADES_DIFERENTES',
      'timeAdversarioId',
      'O adversário deve ser da mesma modalidade do time.',
    ],
    ['inicio fora do intervalo, no campo Data', 400, 'VALIDATION_ERROR', 'inicio', 'Data longe.'],
  ])('erro da API em details[]: %s', async (_caso, status, code, field, message) => {
    eventos.criarEvento.mockRejectedValue(
      new ApiErro({ status, code, message, details: [{ field, message }] }),
    )
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherJogoDeVolei()
    await salvar()

    expect(await screen.findByText(message)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('data no passado pede confirmação antes de salvar', async () => {
    eventos.criarEvento.mockResolvedValue(EVENTO)
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherJogoDeVolei()
    await fireEvent.changeText(screen.getByLabelText('Data'), '20/09/2026')
    await salvar()

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Evento no passado',
        'Este evento está no passado. Deseja salvar mesmo assim?',
        expect.any(Array),
      ),
    )
    expect(eventos.criarEvento).not.toHaveBeenCalled()
    await confirmarAlerta('Salvar')
    expect(eventos.criarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ inicio: '2026-09-20T22:00:00.000Z' }),
    )
  })

  it('offline: Salvar desabilitado e a ação avisa sem chamar a API (critério 21)', async () => {
    onlineManager.setOnline(false)
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText('Modo offline')).toBeOnTheScreen()
    expect(MENSAGEM_ACAO_OFFLINE).toBe(
      'Sem conexão. Conecte-se à internet para concluir esta ação.',
    )
  })

  it('cai offline depois de preencher: Salvar bloqueado e os dados ficam no formulário (#29, critério 4)', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await preencherJogoDeVolei()

    await act(() => onlineManager.setOnline(false))
    await salvar()

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(eventos.criarEvento).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Local')).toHaveDisplayValue('Ginásio Castelinho')
    expect(screen.getByRole('radio', { name: 'Fênix Vôlei · FNX' })).toBeSelected()
  })

  it('observações têm contador até 500', async () => {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    expect(screen.getByText('0/500')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Observações'), 'Chegar cedo')
    expect(screen.getByText('11/500')).toBeOnTheScreen()
  })

  it('renderiza o slot abaixo de Data/Horário', async () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
    await renderizar(<EventoForm aoSalvar={jest.fn()} aposDataHora={<Text>Recorrente</Text>} />)
    expect(screen.getByText('Recorrente')).toBeOnTheScreen()
  })
})

describe('AdversarioRapidoSheet', () => {
  async function abrirSheet() {
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await fireEvent.changeText(screen.getByLabelText('Local'), 'Ginásio Castelinho')
    await fireEvent.changeText(screen.getByLabelText('Data'), '10102026')
    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei Masculino' }))
    await fireEvent.press(screen.getByRole('button', { name: '+ Cadastrar adversário' }))
    expect(screen.getAllByText('Modalidade: Vôlei', { exact: true })).toHaveLength(2)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Atlética Fênix (FNX)' }))
    await fireEvent.changeText(screen.getByLabelText('Nome do time'), 'Fênix Vôlei B')
  }

  it('sucesso seleciona o novo time sem perder os dados do formulário (critério 20)', async () => {
    times.criarTime.mockResolvedValue(NOVO_ADVERSARIO)
    await abrirSheet()
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar adversário' }))

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Fênix Vôlei B · FNX' })).toBeSelected(),
    )
    expect(times.criarTime).toHaveBeenCalledWith({
      nome: 'Fênix Vôlei B',
      modalidadeId: VOLEI.id,
      atleticaAdversariaId: FENIX.id,
    })
    expect(screen.queryByLabelText('Nome do time')).toBeNull()
    expect(screen.getByLabelText('Local')).toHaveDisplayValue('Ginásio Castelinho')
    expect(screen.getByLabelText('Data')).toHaveDisplayValue('10/10/2026')
    expect(screen.getByRole('radio', { name: 'Vôlei Masculino' })).toBeSelected()
  })

  it('atlética nova é gravada antes do time, só ao salvar', async () => {
    const nova: AtleticaAdversaria = { ...FENIX, id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' }
    times.criarAtleticaAdversaria.mockResolvedValue(nova)
    times.criarTime.mockResolvedValue(NOVO_ADVERSARIO)
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei Masculino' }))
    await fireEvent.press(screen.getByRole('button', { name: '+ Cadastrar adversário' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar nova atlética' }))
    await fireEvent.changeText(screen.getByLabelText('Nome da atlética'), 'Atlética Fênix')
    await fireEvent.changeText(screen.getByLabelText('Sigla (opcional)'), 'fnx')
    await fireEvent.changeText(screen.getByLabelText('Nome do time'), 'Fênix Vôlei B')
    expect(times.criarAtleticaAdversaria).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar adversário' }))

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Fênix Vôlei B · FNX' })).toBeSelected(),
    )
    expect(times.criarAtleticaAdversaria).toHaveBeenCalledWith({
      nome: 'Atlética Fênix',
      sigla: 'FNX',
      curso: null,
    })
    expect(times.criarTime).toHaveBeenCalledWith({
      nome: 'Fênix Vôlei B',
      modalidadeId: VOLEI.id,
      atleticaAdversariaId: nova.id,
    })
    expect(times.criarAtleticaAdversaria.mock.invocationCallOrder[0]).toBeLessThan(
      times.criarTime.mock.invocationCallOrder[0]!,
    )
  })

  it('erro no time após gravar a atlética nova não a duplica ao repetir', async () => {
    const mensagem = 'Já existe um time com este nome nesta modalidade.'
    times.criarAtleticaAdversaria.mockResolvedValue(FENIX)
    times.criarTime
      .mockRejectedValueOnce(
        new ApiErro({
          status: 409,
          code: 'TIME_DUPLICADO',
          message: mensagem,
          details: [{ field: 'nome', message: mensagem }],
        }),
      )
      .mockResolvedValueOnce(NOVO_ADVERSARIO)
    await renderizar(<EventoForm aoSalvar={jest.fn()} />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei Masculino' }))
    await fireEvent.press(screen.getByRole('button', { name: '+ Cadastrar adversário' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar nova atlética' }))
    await fireEvent.changeText(screen.getByLabelText('Nome da atlética'), 'Atlética Fênix')
    await fireEvent.changeText(screen.getByLabelText('Nome do time'), 'Fênix Vôlei')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar adversário' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Atlética Fênix (FNX)' })).toBeSelected()
    await fireEvent.changeText(screen.getByLabelText('Nome do time'), 'Fênix Vôlei B')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar adversário' }))

    await waitFor(() => expect(times.criarTime).toHaveBeenCalledTimes(2))
    expect(times.criarAtleticaAdversaria).toHaveBeenCalledTimes(1)
  })

  it('erro da API mantém o sheet aberto com os dados', async () => {
    const mensagem = 'Já existe um time com este nome nesta modalidade.'
    times.criarTime.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'TIME_DUPLICADO',
        message: mensagem,
        details: [{ field: 'nome', message: mensagem }],
      }),
    )
    await abrirSheet()
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar adversário' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(screen.getByLabelText('Nome do time')).toHaveDisplayValue('Fênix Vôlei B')
    expect(screen.getByRole('radio', { name: 'Atlética Fênix (FNX)' })).toBeSelected()
  })
})

describe('Detalhe do evento no Painel', () => {
  it('mostra o jogo e esconde Excluir para Diretor', async () => {
    await renderizar(<EventoPainel />)

    expect(await screen.findByText('Vôlei Masculino × Atlética Fênix')).toBeOnTheScreen()
    expect(screen.getByText('10/10/2026 19:00')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Cancelar evento' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull()
  })

  it.each(['PRESIDENTE', 'VICE_PRESIDENTE'] as const)(
    '%s exclui com confirmação destrutiva',
    async (papel) => {
      comPapel(papel)
      eventos.excluirEvento.mockResolvedValue()
      await renderizar(<EventoPainel />)
      await fireEvent.press(await screen.findByRole('button', { name: 'Excluir' }))

      const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
      expect(botoes?.find(({ text }) => text === 'Excluir')?.style).toBe('destructive')
      await confirmarAlerta('Excluir')

      await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Evento excluído'))
      expect(eventos.excluirEvento).toHaveBeenCalledWith(EVENTO.id)
      const { router } = jest.requireMock<typeof import('expo-router')>('expo-router')
      expect(router.back).toHaveBeenCalled()
    },
  )

  it('409 EVENTO_COM_DEPENDENCIAS mostra a mensagem específica (critério 16)', async () => {
    comPapel('PRESIDENTE')
    eventos.excluirEvento.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'EVENTO_COM_DEPENDENCIAS',
        message: 'Conflito.',
        details: [{ field: 'participacoes', message: '3 respostas' }],
      }),
    )
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir' }))
    await confirmarAlerta('Excluir')

    await waitFor(() =>
      expect(toast.erro).toHaveBeenCalledWith(
        'Este evento tem respostas, presenças ou resultado. Cancele-o em vez de excluir.',
      ),
    )
    expect(toast.erro).toHaveBeenCalledTimes(1)
  })

  it('cancela após a confirmação', async () => {
    eventos.cancelarEvento.mockResolvedValue({ eventoIds: [EVENTO.id], status: 'CANCELADO' })
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar evento' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancelar evento?',
      'O evento ficará como Cancelado e continuará visível na agenda até a data prevista.',
      expect.any(Array),
    )
    await confirmarAlerta('Cancelar evento')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Evento cancelado'))
    expect(eventos.cancelarEvento).toHaveBeenCalledWith(EVENTO.id, undefined)
  })

  it('evento cancelado não mostra Editar nem Cancelar', async () => {
    comStatus('CANCELADO')
    await renderizar(<EventoPainel />)

    expect(await screen.findByText('Cancelado')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar evento' })).toBeNull()
  })

  it('offline: ações de escrita desabilitadas', async () => {
    comPapel('PRESIDENTE')
    await renderizar(<EventoPainel />)
    await screen.findByText('Vôlei Masculino × Atlética Fênix')
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: 'Cancelar evento' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
    expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
  })
})

describe('Edição', () => {
  it('envia só os campos alterados', async () => {
    eventos.atualizarEvento.mockResolvedValue(EVENTO)
    await renderizar(<EditarEvento />)

    expect(await screen.findByRole('radio', { name: 'Jogo' })).toBeDisabled()
    expect(await screen.findByRole('radio', { name: 'Fênix Vôlei · FNX' })).toBeSelected()
    await fireEvent.changeText(screen.getByLabelText('Horário'), '2030')
    await fireEvent.changeText(screen.getByLabelText('Local'), 'Quadra Central')
    await salvar()

    await waitFor(() =>
      expect(eventos.atualizarEvento).toHaveBeenCalledWith(EVENTO.id, {
        inicio: '2026-10-10T23:30:00.000Z',
        local: 'Quadra Central',
      }),
    )
    expect(toast.sucesso).toHaveBeenCalledWith('Evento atualizado')
  })

  it('evento FINALIZADO: só Observações habilitado', async () => {
    comStatus('FINALIZADO')
    eventos.atualizarEvento.mockResolvedValue(EVENTO)
    await renderizar(<EditarEvento />)

    await fireEvent.changeText(await screen.findByLabelText('Observações'), 'Jogo duro')
    for (const rotulo of ['Data', 'Horário', 'Local']) {
      expect(screen.getByLabelText(rotulo)).toHaveProp('editable', false)
    }
    expect(screen.getByRole('radio', { name: 'Vôlei Masculino' })).toBeDisabled()
    expect(screen.queryByLabelText('Buscar adversário')).toBeNull()
    await salvar()

    await waitFor(() =>
      expect(eventos.atualizarEvento).toHaveBeenCalledWith(EVENTO.id, { observacoes: 'Jogo duro' }),
    )
  })

  it('422 EVENTO_CANCELADO aparece no toast (critério 10)', async () => {
    const mensagem = 'Evento cancelado não pode ser editado.'
    eventos.atualizarEvento.mockRejectedValue(
      new ApiErro({ status: 422, code: 'EVENTO_CANCELADO', message: mensagem }),
    )
    await renderizar(<EditarEvento />)
    await fireEvent.changeText(await screen.findByLabelText('Local'), 'Quadra Central')
    await salvar()

    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(mensagem))
  })

  it('422 EVENTO_FINALIZADO aparece no toast (critério 11)', async () => {
    const mensagem = 'Evento finalizado: só as observações podem ser alteradas.'
    eventos.atualizarEvento.mockRejectedValue(
      new ApiErro({ status: 422, code: 'EVENTO_FINALIZADO', message: mensagem }),
    )
    await renderizar(<EditarEvento />)
    await fireEvent.changeText(await screen.findByLabelText('Local'), 'Quadra Central')
    await salvar()

    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(mensagem))
    expect(screen.getByLabelText('Local')).toHaveDisplayValue('Quadra Central')
  })

  it('evento CANCELADO não abre o formulário', async () => {
    comStatus('CANCELADO')
    await renderizar(<EditarEvento />)
    expect(await screen.findByText('Evento cancelado não pode ser editado.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
  })
})
