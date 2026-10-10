import type { ListaTimes, TimeDto } from '@atletica/shared'
import {
  onlineManager,
  QueryClientProvider,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import { FormAviso, MENSAGEM_SEM_DESTINATARIOS } from '@/features/avisos'
import * as apiAvisos from '@/features/avisos/api'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'
import Painel from '../app/(app)/(abas)/painel/index'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/avisos/api')
jest.mock('@/features/times/api')
jest.mock('@/features/solicitacoes', () => ({ useTotalPendentes: () => ({ data: 0 }) }))

const api = jest.mocked(apiAvisos)
const apiTime = jest.mocked(apiTimes)

const FUTSAL = '7c1e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const TITULO = 'Treino cancelado hoje'
const MENSAGEM = 'Por causa da chuva, o treino das 19h está cancelado.'

const time = (id: string, nome: string): TimeDto => ({
  id,
  nome,
  ativo: true,
  modalidade: { id: 'm1', nome: 'Futsal', icone: 'soccer' },
  atletica: { id: 'a1', nome: 'Atlética', sigla: 'ATL', propria: true },
  capitao: null,
  totalMembros: 8,
})

let cliente: QueryClient

function renderizar(elemento: ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

async function preencher(titulo = TITULO, mensagem = MENSAGEM) {
  await fireEvent.changeText(screen.getByLabelText('Título'), titulo)
  await fireEvent.changeText(screen.getByLabelText('Mensagem'), mensagem)
  await act(() => Promise.resolve())
}

const tocarEnviar = () => fireEvent.press(screen.getByRole('button', { name: 'Enviar aviso' }))

async function confirmarAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
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
  api.buscarAlcanceAviso.mockResolvedValue(142)
  api.enviarAviso.mockResolvedValue({
    avisoId: '3b9f6c1d-2a4e-4b7f-9c8d-1e2f3a4b5c6d',
    destinatarios: 3,
    enviadoEm: '2026-10-01T21:00:00.000Z',
  })
  apiTime.listarTimes.mockResolvedValue({
    items: [time(FUTSAL, 'Futsal Masculino')],
    page: 1,
    limit: 20,
    total: 1,
  })
})

afterEach(() => cliente.clear())

describe('Painel', () => {
  it('diretor vê o item "Enviar aviso"', async () => {
    await renderizar(<Painel />)
    expect(screen.getByRole('link', { name: 'Enviar aviso' })).toBeOnTheScreen()
  })
})

describe('FormAviso', () => {
  it('contadores de título (0/65) e mensagem (0/500)', async () => {
    await renderizar(<FormAviso />)
    expect(screen.getByText('0/65')).toBeOnTheScreen()
    expect(screen.getByText('0/500')).toBeOnTheScreen()

    await preencher('Aviso', 'Olá a todos')

    expect(screen.getByText('5/65')).toBeOnTheScreen()
    expect(screen.getByText('11/500')).toBeOnTheScreen()
  })

  it('alcance para todos: "Será enviado para N pessoas" (critério 13)', async () => {
    await renderizar(<FormAviso />)
    expect(await screen.findByText('Será enviado para 142 pessoas')).toBeOnTheScreen()
    expect(api.buscarAlcanceAviso).toHaveBeenCalledWith({ destino: 'TODOS' }, expect.anything())
  })

  it('Time: exige escolher o time antes de enviar', async () => {
    await renderizar(<FormAviso />)
    await preencher()
    await fireEvent.press(screen.getByRole('tab', { name: 'Time' }))
    await tocarEnviar()

    expect(await screen.findByText('Selecione o time.')).toBeOnTheScreen()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('Time: alcance e envio para os membros do time escolhido', async () => {
    api.buscarAlcanceAviso.mockResolvedValue(1)
    await renderizar(<FormAviso />)
    await preencher()
    await fireEvent.press(screen.getByRole('tab', { name: 'Time' }))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal Masculino · Futsal' }))

    expect(await screen.findByText('Será enviado para 1 pessoa')).toBeOnTheScreen()
    expect(api.buscarAlcanceAviso).toHaveBeenLastCalledWith(
      { destino: 'TIME', timeId: FUTSAL },
      expect.anything(),
    )

    await tocarEnviar()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    expect(jest.mocked(Alert.alert).mock.lastCall?.[1]).toBe(
      'Enviar aviso para membros de Futsal Masculino? Esta ação não pode ser desfeita.',
    )
    await confirmarAlerta('Enviar')

    expect(api.enviarAviso).toHaveBeenCalledWith({
      destino: 'TIME',
      timeId: FUTSAL,
      titulo: TITULO,
      mensagem: MENSAGEM,
    })
  })

  it('Time sem o nome carregado: "membros do time" na confirmação', async () => {
    await renderizar(<FormAviso />)
    await preencher()
    await fireEvent.press(screen.getByRole('tab', { name: 'Time' }))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal Masculino · Futsal' }))
    await act(() =>
      cliente.setQueriesData<InfiniteData<ListaTimes>>(
        { queryKey: chaves.times.todos() },
        (dados) => dados && { ...dados, pages: dados.pages.map((p) => ({ ...p, items: [] })) },
      ),
    )
    await tocarEnviar()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())

    expect(jest.mocked(Alert.alert).mock.lastCall?.[1]).toBe(
      'Enviar aviso para membros do time? Esta ação não pode ser desfeita.',
    )
  })

  it('confirma, envia para todos, mostra o toast com N e limpa o formulário', async () => {
    await renderizar(<FormAviso />)
    await preencher()
    await tocarEnviar()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())

    expect(jest.mocked(Alert.alert).mock.lastCall?.[1]).toBe(
      'Enviar aviso para todos os usuários? Esta ação não pode ser desfeita.',
    )
    expect(api.enviarAviso).not.toHaveBeenCalled()

    await confirmarAlerta('Enviar')

    expect(api.enviarAviso).toHaveBeenCalledWith({
      destino: 'TODOS',
      titulo: TITULO,
      mensagem: MENSAGEM,
    })
    expect(toast.sucesso).toHaveBeenCalledWith('Aviso enviado para 3 pessoas.')
    expect(screen.getByLabelText('Título').props.value).toBe('')
    expect(screen.getByLabelText('Mensagem').props.value).toBe('')
  })

  it('nenhum destinatário: mensagem própria (critério 11)', async () => {
    api.enviarAviso.mockResolvedValue({
      avisoId: '3b9f6c1d-2a4e-4b7f-9c8d-1e2f3a4b5c6d',
      destinatarios: 0,
      enviadoEm: '2026-10-01T21:00:00.000Z',
    })
    await renderizar(<FormAviso />)
    await preencher()
    await tocarEnviar()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Enviar')

    expect(toast.info).toHaveBeenCalledWith(MENSAGEM_SEM_DESTINATARIOS)
  })

  it('título com 66 caracteres: erro no campo, sem enviar (critério 8)', async () => {
    await renderizar(<FormAviso />)
    await preencher('x'.repeat(66))
    await tocarEnviar()

    expect(await screen.findByText('O título deve ter no máximo 65 caracteres.')).toBeOnTheScreen()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('erro da API no time vai para o campo', async () => {
    api.enviarAviso.mockRejectedValue(
      new ApiErro({
        status: 422,
        code: 'TIME_INVALIDO_AVISO',
        message: 'Selecione um time ativo da atlética.',
        details: [{ field: 'timeId', message: 'Selecione um time ativo da atlética.' }],
      }),
    )
    await renderizar(<FormAviso />)
    await preencher()
    await fireEvent.press(screen.getByRole('tab', { name: 'Time' }))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal Masculino · Futsal' }))
    await tocarEnviar()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Enviar')

    expect(await screen.findByText('Selecione um time ativo da atlética.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Título').props.value).toBe(TITULO)
  })

  it('offline: botão bloqueado e o texto é mantido (critério 14)', async () => {
    await renderizar(<FormAviso />)
    await preencher()
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: 'Enviar aviso' })).toBeDisabled()
    await tocarEnviar()

    expect(Alert.alert).not.toHaveBeenCalled()
    expect(api.enviarAviso).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título').props.value).toBe(TITULO)
  })
})
