import type { AtleticaPublica, EventoDetalheDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import EventoPainel from '../app/(app)/(abas)/painel/eventos/[id]/index'
import ResultadoEvento from '../app/(app)/(abas)/painel/eventos/[id]/resultado'
import { toast } from '@/components/ui/toast'
import * as apiEventos from '@/features/eventos/api'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/eventos/api')
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f' }),
}))

const eventos = jest.mocked(apiEventos)
const { router } = jest.requireMock<typeof import('expo-router')>('expo-router')

const AGORA = Date.parse('2026-10-01T12:00:00.000Z')

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
  id: '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f',
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2026-10-10T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  observacoes: null,
  serieId: null,
  time: { id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', nome: 'Vôlei Masculino' },
  modalidade: { id: '7a2d3b8f-3a6c-4d4a-8b1f-4a4c2c9e3d22', nome: 'Vôlei', icone: 'volleyball' },
  timeAdversario: {
    id: 'd4c3b2a1-6f5e-4b7a-9c8d-5d4c3b2a1f0e',
    nome: 'Fênix Vôlei',
    atletica: { id: 'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b', nome: 'Atlética Fênix', sigla: 'FNX' },
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

const PASSADO = '2026-09-20T22:00:00.000Z'

const CORRIGIVEL: EventoDetalheDto = {
  ...EVENTO,
  status: 'FINALIZADO',
  inicio: PASSADO,
  placarTime: 3,
  placarAdversario: 1,
  resultado: 'VITORIA',
}

const conflito = () =>
  new ApiErro({ status: 409, code: 'CONFLITO_STATUS', message: 'O status mudou.' })

let cliente: QueryClient

function renderizar(elemento: ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

function comEvento(parcial: Partial<EventoDetalheDto>) {
  eventos.buscarEvento.mockResolvedValue({ ...EVENTO, ...parcial })
}

async function tocarNoAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

const chip = (rotulo: string) => screen.getByRole('radio', { name: rotulo })

const placar = (rotulo: string) => screen.getByLabelText(rotulo)

async function digitarPlacar(nosso: string, adversario: string) {
  await fireEvent.changeText(await screen.findByLabelText('Vôlei Masculino'), nosso)
  await fireEvent.changeText(placar('Atlética Fênix'), adversario)
}

const salvar = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(AGORA)
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: 'u1',
      nome: 'Ana',
      email: 'a@x.com',
      fotoUrl: null,
      papel: 'DIRETOR',
      atleticaId: CASA.id,
    },
  })
  cliente.setQueryData(chaves.atletica(), CASA)
  eventos.buscarEvento.mockResolvedValue(EVENTO)
})

afterEach(() => {
  cliente.clear()
  jest.restoreAllMocks()
})

describe('StatusEventoSelector', () => {
  it('AGENDADO: atual destacado e destinos da máquina de estados habilitados', async () => {
    await renderizar(<EventoPainel />)

    expect(await screen.findByRole('radio', { name: 'Agendado' })).toBeSelected()
    for (const destino of ['Em andamento', 'Finalizado', 'Cancelado']) {
      expect(chip(destino)).toBeEnabled()
    }
  })

  it('FINALIZADO: só volta para Em andamento (TRANSICOES_STATUS)', async () => {
    comEvento({ status: 'FINALIZADO' })
    await renderizar(<EventoPainel />)

    expect(await screen.findByRole('radio', { name: 'Finalizado' })).toBeSelected()
    expect(chip('Em andamento')).toBeEnabled()
    expect(chip('Agendado')).toBeDisabled()
    expect(chip('Cancelado')).toBeDisabled()
  })

  it('CANCELADO: nenhum destino e o aviso de status terminal', async () => {
    comEvento({ status: 'CANCELADO' })
    await renderizar(<EventoPainel />)

    expect(
      await screen.findByText('Eventos cancelados não podem mudar de status.'),
    ).toBeOnTheScreen()
    for (const destino of ['Agendado', 'Em andamento', 'Finalizado']) {
      expect(chip(destino)).toBeDisabled()
    }
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).toBeNull()
  })

  it('FINALIZADO com resultado: nenhum destino, como a guarda da API', async () => {
    eventos.buscarEvento.mockResolvedValue(CORRIGIVEL)
    await renderizar(<EventoPainel />)

    expect(
      await screen.findByText('Jogos com resultado registrado não podem mudar de status.'),
    ).toBeOnTheScreen()
    for (const destino of ['Agendado', 'Em andamento', 'Cancelado']) {
      expect(chip(destino)).toBeDisabled()
    }
  })

  it('cancelamento em andamento: destinos desabilitados', async () => {
    eventos.cancelarEvento.mockReturnValue(new Promise(() => undefined))
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Cancelado' }))
    await tocarNoAlerta('Cancelar evento')

    await waitFor(() => expect(chip('Em andamento')).toBeDisabled())
    expect(chip('Finalizado')).toBeDisabled()
  })

  it('início futuro: a confirmação avisa a data prevista e só então altera', async () => {
    eventos.alterarStatusEvento.mockResolvedValue({
      id: EVENTO.id,
      status: 'EM_ANDAMENTO',
      statusAnterior: 'AGENDADO',
    })
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Em andamento' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Marcar como Em andamento?',
      'O evento ficará como Em andamento, mas está previsto para 10/10/2026 19:00.',
      expect.any(Array),
    )
    expect(eventos.alterarStatusEvento).not.toHaveBeenCalled()
    await tocarNoAlerta('Confirmar')

    await waitFor(() =>
      expect(toast.sucesso).toHaveBeenCalledWith('Status alterado para Em andamento'),
    )
    expect(eventos.alterarStatusEvento).toHaveBeenCalledWith(EVENTO.id, 'EM_ANDAMENTO')
  })

  it('início passado: confirmação sem aviso de data', async () => {
    comEvento({ status: 'EM_ANDAMENTO', inicio: PASSADO })
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Finalizado' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Marcar como Finalizado?',
      'O evento ficará como Finalizado.',
      expect.any(Array),
    )
  })

  it('destino Cancelado usa o fluxo de cancelamento (POST /cancelar)', async () => {
    eventos.cancelarEvento.mockResolvedValue({ eventoIds: [EVENTO.id], status: 'CANCELADO' })
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Cancelado' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancelar evento?',
      expect.any(String),
      expect.any(Array),
    )
    await tocarNoAlerta('Cancelar evento')

    await waitFor(() => expect(eventos.cancelarEvento).toHaveBeenCalledWith(EVENTO.id, undefined))
    expect(eventos.alterarStatusEvento).not.toHaveBeenCalled()
  })

  it('409 CONFLITO_STATUS: toast próprio e recarga do evento', async () => {
    eventos.alterarStatusEvento.mockRejectedValue(conflito())
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Em andamento' }))
    await tocarNoAlerta('Confirmar')

    await waitFor(() =>
      expect(toast.erro).toHaveBeenCalledWith('O status foi alterado por outra pessoa'),
    )
    expect(toast.erro).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(eventos.buscarEvento).toHaveBeenCalledTimes(2))
  })

  it('offline: destinos desabilitados e nenhuma requisição (critério 22)', async () => {
    await renderizar(<EventoPainel />)
    await screen.findByRole('radio', { name: 'Agendado' })
    await act(() => onlineManager.setOnline(false))

    for (const destino of ['Em andamento', 'Finalizado', 'Cancelado']) {
      expect(chip(destino)).toBeDisabled()
    }
    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
    await fireEvent.press(chip('Em andamento'))
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(eventos.alterarStatusEvento).not.toHaveBeenCalled()
  })
})

describe('Botão de resultado no detalhe', () => {
  it('jogo sem placar: "Registrar resultado" abre a tela de resultado', async () => {
    await renderizar(<EventoPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Registrar resultado' }))
    expect(router.push).toHaveBeenCalledWith(`/painel/eventos/${EVENTO.id}/resultado`)
  })

  it('jogo com placar: mostra o placar e "Corrigir resultado"', async () => {
    eventos.buscarEvento.mockResolvedValue(CORRIGIVEL)
    await renderizar(<EventoPainel />)

    expect(await screen.findByText('Vitória da CASA por 3 × 1')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Corrigir resultado' })).toBeOnTheScreen()
  })

  it('jogo finalizado sem placar mostra "Resultado pendente"', async () => {
    comEvento({ status: 'FINALIZADO', inicio: PASSADO })
    await renderizar(<EventoPainel />)
    expect(await screen.findByText('Resultado pendente')).toBeOnTheScreen()
  })

  it('treino não tem resultado', async () => {
    comEvento({ tipo: 'TREINO', timeAdversario: null })
    await renderizar(<EventoPainel />)
    await screen.findByRole('radio', { name: 'Agendado' })
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).toBeNull()
  })
})

describe('Tela de resultado', () => {
  it('prévia com a sigla da atlética muda com os valores (critério 20)', async () => {
    comEvento({ status: 'FINALIZADO', inicio: PASSADO })
    await renderizar(<ResultadoEvento />)

    expect(await screen.findByText('Vôlei Masculino × Atlética Fênix')).toBeOnTheScreen()
    expect(screen.queryByLabelText(/^Prévia/)).toBeNull()
    await digitarPlacar('2', '1')
    expect(await screen.findByText('Vitória da CASA')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar Atlética Fênix' }))
    expect(placar('Atlética Fênix')).toHaveDisplayValue('2')
    expect(await screen.findByText('Empate')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir Vôlei Masculino' }))
    expect(await screen.findByText('Derrota da CASA')).toBeOnTheScreen()
  })

  it('jogo finalizado: salva sem diálogo, sem "finalizar"', async () => {
    comEvento({ status: 'FINALIZADO', inicio: PASSADO })
    eventos.registrarResultado.mockResolvedValue({ ...CORRIGIVEL, placarTime: 2 })
    await renderizar(<ResultadoEvento />)
    await digitarPlacar('2', '1')
    await salvar()

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Resultado registrado'))
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(eventos.registrarResultado).toHaveBeenCalledWith(EVENTO.id, {
      placarTime: 2,
      placarAdversario: 1,
    })
    expect(router.back).toHaveBeenCalled()
  })

  it('jogo em andamento: diálogo do UC17 A1 e confirmar envia finalizar (critério 19)', async () => {
    comEvento({ status: 'EM_ANDAMENTO', inicio: PASSADO })
    eventos.registrarResultado.mockResolvedValue(CORRIGIVEL)
    await renderizar(<ResultadoEvento />)
    await digitarPlacar('3', '1')
    await salvar()

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Finalizar jogo?',
        'O jogo ainda não foi finalizado. Finalizar e registrar o placar?',
        expect.any(Array),
      ),
    )
    expect(eventos.registrarResultado).not.toHaveBeenCalled()
    await tocarNoAlerta('Finalizar e registrar')

    await waitFor(() =>
      expect(eventos.registrarResultado).toHaveBeenCalledWith(EVENTO.id, {
        placarTime: 3,
        placarAdversario: 1,
        finalizar: true,
      }),
    )
  })

  it('recusar o diálogo não salva', async () => {
    comEvento({ status: 'AGENDADO' })
    await renderizar(<ResultadoEvento />)
    await digitarPlacar('3', '1')
    await salvar()

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await tocarNoAlerta('Voltar')
    expect(eventos.registrarResultado).not.toHaveBeenCalled()
  })

  it('correção: valores atuais, aviso de auditoria e toast próprio', async () => {
    eventos.buscarEvento.mockResolvedValue(CORRIGIVEL)
    eventos.registrarResultado.mockResolvedValue({
      ...CORRIGIVEL,
      placarAdversario: 3,
      resultado: 'DERROTA',
    })
    await renderizar(<ResultadoEvento />)

    expect(await screen.findByLabelText('Vôlei Masculino')).toHaveDisplayValue('3')
    expect(placar('Atlética Fênix')).toHaveDisplayValue('1')
    expect(
      screen.getByText('A alteração ficará registrada no histórico de auditoria.'),
    ).toBeOnTheScreen()
    await fireEvent.changeText(placar('Atlética Fênix'), '4')
    await salvar()

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Resultado corrigido'))
    expect(eventos.registrarResultado).toHaveBeenCalledWith(EVENTO.id, {
      placarTime: 3,
      placarAdversario: 4,
    })
  })

  it.each([
    ['1000', 'O placar deve estar entre 0 e 999.'],
    ['', 'Informe o placar.'],
  ])('placar "%s" bloqueia o Salvar', async (valor, mensagem) => {
    comEvento({ status: 'FINALIZADO', inicio: PASSADO })
    await renderizar(<ResultadoEvento />)
    await digitarPlacar(valor, '1')
    await salvar()

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(screen.queryByLabelText(/^Prévia/)).toBeNull()
    expect(eventos.registrarResultado).not.toHaveBeenCalled()
  })

  it('offline: Salvar desabilitado e nenhuma requisição (critério 22)', async () => {
    comEvento({ status: 'FINALIZADO', inicio: PASSADO })
    await renderizar(<ResultadoEvento />)
    await digitarPlacar('2', '1')
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
    await salvar()
    expect(eventos.registrarResultado).not.toHaveBeenCalled()
  })

  it('409 CONFLITO_STATUS: toast próprio e recarga do evento', async () => {
    comEvento({ status: 'EM_ANDAMENTO', inicio: PASSADO })
    eventos.registrarResultado.mockRejectedValue(conflito())
    await renderizar(<ResultadoEvento />)
    await digitarPlacar('2', '1')
    await salvar()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await tocarNoAlerta('Finalizar e registrar')

    await waitFor(() =>
      expect(toast.erro).toHaveBeenCalledWith('O status foi alterado por outra pessoa'),
    )
    expect(toast.erro).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(eventos.buscarEvento).toHaveBeenCalledTimes(2))
    expect(router.back).not.toHaveBeenCalled()
  })

  it('treino não abre o formulário', async () => {
    comEvento({ tipo: 'TREINO', timeAdversario: null })
    await renderizar(<ResultadoEvento />)
    expect(await screen.findByText('Treinos não têm placar.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
  })
})
