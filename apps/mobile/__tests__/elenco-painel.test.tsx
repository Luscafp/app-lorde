import type { ElencoDto, MembroElencoDto, TimeDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import ElencoTime from '../app/(app)/(abas)/painel/times/[id]/elenco'
import { toast } from '@/components/ui/toast'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/times/api')
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' }),
}))

const api = jest.mocked(apiTimes)

const ANA: MembroElencoDto = {
  usuarioId: 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f',
  nome: 'Ana Souza',
  fotoUrl: null,
  entradaEm: '2026-08-10T13:00:00.000Z',
  capitao: true,
}
const BRUNO: MembroElencoDto = {
  usuarioId: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
  nome: 'Bruno Lima',
  fotoUrl: null,
  entradaEm: '2026-09-01T13:00:00.000Z',
  capitao: false,
}

const TIME: TimeDto = {
  id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  nome: 'Futsal Masculino',
  ativo: true,
  modalidade: { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal', icone: 'soccer' },
  atletica: {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    nome: 'Lorde',
    sigla: 'LRD',
    propria: true,
  },
  capitao: { id: ANA.usuarioId, nome: ANA.nome },
  totalMembros: 2,
}

const elenco = (...items: MembroElencoDto[]): ElencoDto => ({ items, total: items.length })

let cliente: QueryClient

async function renderizar() {
  await render(
    <QueryClientProvider client={cliente}>
      <ElencoTime />
    </QueryClientProvider>,
  )
}

async function abrirElenco() {
  await renderizar()
  await screen.findByText(BRUNO.nome)
}

const ultimoAlerta = () => jest.mocked(Alert.alert).mock.lastCall

async function tocarNoAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = ultimoAlerta()?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

async function abrirMenu(nome: string) {
  await fireEvent.press(screen.getByRole('button', { name: `Ações de ${nome}` }))
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  api.buscarTime.mockResolvedValue({ ...TIME, minhaSituacao: null })
  api.buscarElenco.mockResolvedValue(elenco(BRUNO, ANA))
})

afterEach(() => cliente.clear())

describe('ElencoPainel', () => {
  it('lista o capitão primeiro, com chip e data de entrada', async () => {
    await abrirElenco()

    const [primeiro, segundo] = screen.getAllByText(/Ana Souza|Bruno Lima/)
    expect(primeiro).toHaveTextContent(ANA.nome)
    expect(segundo).toHaveTextContent(BRUNO.nome)
    expect(screen.getAllByText('CAPITÃO')).toHaveLength(1)
    expect(screen.getByText('Entrou em 10/08/2026')).toBeOnTheScreen()
    expect(api.buscarElenco).toHaveBeenCalledWith(TIME.id, expect.anything())
  })

  it('menu do membro oferece definir capitão e remover do elenco', async () => {
    await abrirElenco()
    await abrirMenu(BRUNO.nome)

    const textos = ultimoAlerta()?.[2]?.map((botao) => botao.text)
    expect(textos).toEqual(['Definir como capitão', 'Remover do elenco', 'Cancelar'])
  })

  it('menu do capitão oferece remover capitania', async () => {
    await abrirElenco()
    await abrirMenu(ANA.nome)

    const textos = ultimoAlerta()?.[2]?.map((botao) => botao.text)
    expect(textos).toEqual(['Remover capitania', 'Remover do elenco', 'Cancelar'])
  })

  it('definir capitão com capitão atual pede confirmação e move o chip', async () => {
    api.definirCapitao.mockResolvedValue({
      ...TIME,
      capitao: { id: BRUNO.usuarioId, nome: BRUNO.nome },
    })
    await abrirElenco()

    await abrirMenu(BRUNO.nome)
    await tocarNoAlerta('Definir como capitão')
    expect(ultimoAlerta()?.[1]).toBe('Bruno Lima será o capitão no lugar de Ana Souza.')
    expect(ultimoAlerta()?.[2]?.find(({ text }) => text === 'Confirmar')?.style).toBe('default')
    expect(api.definirCapitao).not.toHaveBeenCalled()

    api.buscarElenco.mockResolvedValue(
      elenco({ ...ANA, capitao: false }, { ...BRUNO, capitao: true }),
    )
    await tocarNoAlerta('Confirmar')

    expect(api.definirCapitao).toHaveBeenCalledWith(TIME.id, BRUNO.usuarioId)
    await waitFor(() =>
      expect(screen.getAllByText(/Ana Souza|Bruno Lima/)[0]).toHaveTextContent(BRUNO.nome),
    )
    expect(screen.getAllByText('CAPITÃO')).toHaveLength(1)
    expect(toast.sucesso).toHaveBeenCalledWith('Capitão definido')
  })

  it('definir capitão sem capitão atual não pede confirmação', async () => {
    api.buscarElenco.mockResolvedValue(elenco(BRUNO, { ...ANA, capitao: false }))
    api.definirCapitao.mockResolvedValue(TIME)
    await abrirElenco()

    await abrirMenu(BRUNO.nome)
    await tocarNoAlerta('Definir como capitão')

    expect(api.definirCapitao).toHaveBeenCalledWith(TIME.id, BRUNO.usuarioId)
    expect(Alert.alert).toHaveBeenCalledTimes(1)
  })

  it('remover capitania envia usuário nulo', async () => {
    api.definirCapitao.mockResolvedValue({ ...TIME, capitao: null })
    await abrirElenco()

    await abrirMenu(ANA.nome)
    await tocarNoAlerta('Remover capitania')

    expect(api.definirCapitao).toHaveBeenCalledWith(TIME.id, null)
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Capitania removida'))
  })

  it('remover membro comum confirma e mostra o toast', async () => {
    api.removerMembro.mockResolvedValue()
    await abrirElenco()

    await abrirMenu(BRUNO.nome)
    await tocarNoAlerta('Remover do elenco')
    expect(ultimoAlerta()?.[1]).toBe(
      'Remover Bruno Lima do Futsal Masculino? Para voltar, será preciso uma nova solicitação.',
    )

    api.buscarElenco.mockResolvedValue(elenco(ANA))
    await tocarNoAlerta('Remover')

    expect(api.removerMembro).toHaveBeenCalledWith(TIME.id, BRUNO.usuarioId)
    await waitFor(() => expect(screen.queryByText(BRUNO.nome)).not.toBeOnTheScreen())
    expect(toast.sucesso).toHaveBeenCalledWith('Membro removido')
  })

  it('remover o capitão avisa que o time ficará sem capitão', async () => {
    await abrirElenco()

    await abrirMenu(ANA.nome)
    await tocarNoAlerta('Remover do elenco')

    expect(ultimoAlerta()?.[1]).toBe(
      'Remover Ana Souza do Futsal Masculino? Para voltar, será preciso uma nova solicitação. O time ficará sem capitão.',
    )
  })

  async function esperarToastERecarga(chamadasAntes: number) {
    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith('Já não está no elenco.'))
    await waitFor(() => expect(api.buscarElenco.mock.calls.length).toBeGreaterThan(chamadasAntes))
  }

  it('422 CAPITAO_FORA_DO_ELENCO mostra o toast e recarrega o elenco', async () => {
    api.definirCapitao.mockRejectedValue(
      new ApiErro({
        status: 422,
        code: 'CAPITAO_FORA_DO_ELENCO',
        message: 'Já não está no elenco.',
      }),
    )
    api.buscarElenco.mockResolvedValue(elenco(BRUNO, { ...ANA, capitao: false }))
    await abrirElenco()
    const chamadas = api.buscarElenco.mock.calls.length

    await abrirMenu(BRUNO.nome)
    await tocarNoAlerta('Definir como capitão')

    await esperarToastERecarga(chamadas)
  })

  it('404 MEMBRO_NAO_ENCONTRADO mostra o toast e recarrega o elenco', async () => {
    api.removerMembro.mockRejectedValue(
      new ApiErro({
        status: 404,
        code: 'MEMBRO_NAO_ENCONTRADO',
        message: 'Já não está no elenco.',
      }),
    )
    await abrirElenco()
    const chamadas = api.buscarElenco.mock.calls.length

    await abrirMenu(BRUNO.nome)
    await tocarNoAlerta('Remover do elenco')
    await tocarNoAlerta('Remover')

    await esperarToastERecarga(chamadas)
  })

  it('elenco vazio orienta a usar as solicitações', async () => {
    api.buscarElenco.mockResolvedValue(elenco())
    await renderizar()

    expect(
      await screen.findByText(
        'Elenco ainda vazio. Os atletas entram pelas solicitações (Painel > Solicitações).',
      ),
    ).toBeOnTheScreen()
  })

  it('offline desabilita as ações e mostra a faixa offline', async () => {
    await abrirElenco()
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: `Ações de ${ANA.nome}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `Ações de ${BRUNO.nome}` })).toBeDisabled()
    expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
  })

  it('time adversário não exibe o elenco', async () => {
    api.buscarTime.mockResolvedValue({
      ...TIME,
      atletica: { ...TIME.atletica, propria: false },
      minhaSituacao: null,
    })
    await renderizar()

    expect(
      await screen.findByText('O elenco só é gerido para times da própria atlética.'),
    ).toBeOnTheScreen()
    expect(screen.queryByText(BRUNO.nome)).not.toBeOnTheScreen()
  })

  it('ações ficam desabilitadas até o time carregar', async () => {
    api.buscarTime.mockReturnValue(new Promise(() => undefined))
    await abrirElenco()

    expect(screen.getByRole('button', { name: `Ações de ${BRUNO.nome}` })).toBeDisabled()
  })
})
