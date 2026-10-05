import type { ListaUsuarios, UsuarioDetalhe, UsuarioResumo } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, Text, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import { ApiErro } from '@/infra/api/api-erro'
import { criarQueryClient } from '@/infra/query/query-client'
import { alterarSituacao, buscarUsuario, listarUsuarios } from '@/features/usuarios/api'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { DetalheUsuario, ListaUsuarios as TelaLista } from '@/features/usuarios'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

jest.mock('@/features/usuarios/api', () => ({
  LIMITE_PAGINA: 20,
  listarUsuarios: jest.fn(),
  buscarUsuario: jest.fn(),
  alterarSituacao: jest.fn(),
}))

const ID = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'

const resumo = (id: string, nome: string): UsuarioResumo => ({
  id,
  nome,
  email: `${nome.toLowerCase()}@ex.com`,
  fotoUrl: null,
  papel: 'DIRETOR',
  situacao: 'ATIVO',
})

const lista = (items: UsuarioResumo[], total = items.length): ListaUsuarios => ({
  items,
  page: 1,
  limit: 20,
  total,
})

function detalhe(parcial: Partial<UsuarioDetalhe> = {}): UsuarioDetalhe {
  return {
    id: ID,
    nome: 'José Lima',
    email: 'jose@ex.com',
    fotoUrl: null,
    papel: 'DIRETOR',
    situacao: 'ATIVO',
    criadoEm: '2026-08-01T12:00:00.000Z',
    times: [
      {
        id: 'e1a7c0de-0000-4000-8000-000000000001',
        nome: 'Futsal Masculino',
        modalidade: { id: 'e1a7c0de-0000-4000-8000-000000000002', nome: 'Futsal' },
        capitao: true,
      },
    ],
    estatisticas: null,
    permissoes: {
      podeAlterarSituacao: true,
      motivoBloqueio: null,
      podeAlterarPapel: false,
      ehUltimoAdministrador: false,
    },
    ...parcial,
  }
}

let cliente: QueryClient

function renderizar(elemento: React.ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')))
  onlineManager.setOnline(true)
  jest.clearAllMocks()
})

afterEach(() => {
  cliente.clear()
  jest.useRealTimers()
})

describe('juntarPaginas', () => {
  it('remove itens repetidos entre páginas', () => {
    const a = resumo('a', 'Ana')
    const b = resumo('b', 'Bia')
    expect(juntarPaginas([{ items: [a, b] }, { items: [b, resumo('c', 'Caio')] }])).toHaveLength(3)
  })
})

describe('Lista de usuários', () => {
  it('busca com debounce de 300 ms e só com 0 ou ≥ 2 caracteres', async () => {
    jest.useFakeTimers()
    jest.mocked(listarUsuarios).mockResolvedValue(lista([resumo('a', 'Ana')]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    await act(() => jest.advanceTimersByTimeAsync(0))
    expect(listarUsuarios).toHaveBeenLastCalledWith(
      { busca: undefined, papel: undefined, situacao: undefined },
      1,
      expect.anything(),
    )
    const chamadas = () => jest.mocked(listarUsuarios).mock.calls.map(([filtros]) => filtros.busca)

    const campo = screen.getByLabelText('Buscar por nome ou e-mail')
    await fireEvent.changeText(campo, 'j')
    await act(() => jest.advanceTimersByTimeAsync(1000))
    expect(chamadas()).not.toContain('j')

    await fireEvent.changeText(campo, 'jo')
    await act(() => jest.advanceTimersByTimeAsync(299))
    expect(chamadas()).not.toContain('jo')
    await act(() => jest.advanceTimersByTimeAsync(1))
    expect(chamadas()).toContain('jo')
  })

  it('filtro por pílula refaz a consulta; vazio oferece limpar filtros', async () => {
    jest
      .mocked(listarUsuarios)
      .mockImplementation((filtros) =>
        Promise.resolve(filtros.papel ? lista([]) : lista([resumo('a', 'Ana')])),
      )
    const aoAbrir = jest.fn()
    await renderizar(<TelaLista aoAbrir={aoAbrir} />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Ana, Diretor(a)' }))
    expect(aoAbrir).toHaveBeenCalledWith('a')

    await fireEvent.press(screen.getByRole('radio', { name: 'Presidente' }))
    expect(await screen.findByText('Nenhum usuário encontrado')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await screen.findByText('Ana')).toBeOnTheScreen()
    expect(screen.getAllByRole('radio', { name: 'Todos', selected: true })).toHaveLength(2)
  })

  it('selo "Desativado" no item', async () => {
    jest
      .mocked(listarUsuarios)
      .mockResolvedValue(lista([{ ...resumo('a', 'Ana'), situacao: 'DESATIVADO' }]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    expect(
      await screen.findByRole('button', { name: 'Ana, Diretor(a), desativado' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Desativado')).toBeOnTheScreen()
  })

  it('offline: mostra o cache com a faixa offline (critério 20)', async () => {
    jest.mocked(listarUsuarios).mockResolvedValue(lista([resumo('a', 'Ana')]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    await screen.findByText('Ana')

    await act(() => onlineManager.setOnline(false))

    expect(screen.getByText(/^Modo offline/)).toBeOnTheScreen()
    expect(screen.getByText('Ana')).toBeOnTheScreen()
  })
})

describe('Detalhe do usuário', () => {
  let confirmarAlerta: () => void

  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes?: AlertButton[]) => {
      confirmarAlerta = () => botoes?.[1]?.onPress?.()
    })
  })

  it('perfil, times com selo de capitão e membro desde (critério 5)', async () => {
    jest.mocked(buscarUsuario).mockResolvedValue(detalhe())
    await renderizar(<DetalheUsuario id={ID} />)

    expect(await screen.findByRole('header', { name: 'José Lima' })).toBeOnTheScreen()
    expect(screen.getByText('jose@ex.com')).toBeOnTheScreen()
    expect(screen.getByText('Membro desde 01/08/2026')).toBeOnTheScreen()
    expect(screen.getByText('Futsal Masculino')).toBeOnTheScreen()
    expect(screen.getByText('Capitão')).toBeOnTheScreen()
  })

  it('sem permissão: botão desabilitado com o motivo (critério 9)', async () => {
    const motivo = 'Só é possível alterar usuários de nível de acesso inferior ao seu.'
    jest.mocked(buscarUsuario).mockResolvedValue(
      detalhe({
        papel: 'PRESIDENTE',
        permissoes: { ...detalhe().permissoes, podeAlterarSituacao: false, motivoBloqueio: motivo },
      }),
    )
    await renderizar(<DetalheUsuario id={ID} />)

    expect(await screen.findByRole('button', { name: 'Desativar conta' })).toBeDisabled()
    expect(screen.getByText(motivo)).toBeOnTheScreen()
  })

  it.each([
    [false, 0],
    [true, 1],
  ])('espaço "Alterar cargo" com podeAlterarPapel=%s', async (podeAlterarPapel, vezes) => {
    jest
      .mocked(buscarUsuario)
      .mockResolvedValue(detalhe({ permissoes: { ...detalhe().permissoes, podeAlterarPapel } }))
    await renderizar(<DetalheUsuario id={ID} alterarCargo={() => <Text>Alterar cargo</Text>} />)

    expect(await screen.findByRole('button', { name: 'Desativar conta' })).toBeOnTheScreen()
    expect(screen.queryAllByText('Alterar cargo')).toHaveLength(vezes)
  })

  it('confirmar desativação → mutation, toast e recarga (critério 6)', async () => {
    jest
      .mocked(buscarUsuario)
      .mockResolvedValueOnce(detalhe())
      .mockResolvedValue(detalhe({ situacao: 'DESATIVADO' }))
    jest.mocked(alterarSituacao).mockResolvedValue({ id: ID, situacao: 'DESATIVADO' })
    await renderizar(<DetalheUsuario id={ID} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar conta' }))
    expect(Alert.alert).toHaveBeenCalledWith(
      'Desativar conta',
      'José Lima não poderá mais fazer login até ser reativado.',
      expect.any(Array),
    )
    expect(alterarSituacao).not.toHaveBeenCalled()
    await act(() => confirmarAlerta())

    expect(alterarSituacao).toHaveBeenCalledWith(ID, false)
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Conta desativada'))
    expect(await screen.findByRole('button', { name: 'Reativar conta' })).toBeOnTheScreen()
    expect(buscarUsuario).toHaveBeenCalledTimes(2)
  })

  it('reativar pede confirmação com o texto próprio', async () => {
    jest.mocked(buscarUsuario).mockResolvedValue(detalhe({ situacao: 'DESATIVADO' }))
    jest.mocked(alterarSituacao).mockResolvedValue({ id: ID, situacao: 'ATIVO' })
    await renderizar(<DetalheUsuario id={ID} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Reativar conta' }))
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reativar conta',
      'José Lima poderá voltar a fazer login.',
      expect.any(Array),
    )
    await act(() => confirmarAlerta())
    expect(alterarSituacao).toHaveBeenCalledWith(ID, true)
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Conta reativada'))
  })

  it('erro da API: toast com a mensagem e recarga do detalhe', async () => {
    const message = 'Só é possível alterar usuários de nível de acesso inferior ao seu.'
    jest.mocked(buscarUsuario).mockResolvedValue(detalhe())
    jest
      .mocked(alterarSituacao)
      .mockRejectedValue(new ApiErro({ status: 403, code: 'NIVEL_INSUFICIENTE', message }))
    await renderizar(<DetalheUsuario id={ID} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Desativar conta' }))
    await act(() => confirmarAlerta())

    await waitFor(() => expect(toast.erro).toHaveBeenCalledWith(message))
    await waitFor(() => expect(buscarUsuario).toHaveBeenCalledTimes(2))
  })

  it('offline: botão desabilitado (critério 20)', async () => {
    jest.mocked(buscarUsuario).mockResolvedValue(detalhe())
    await renderizar(<DetalheUsuario id={ID} />)
    await screen.findByRole('button', { name: 'Desativar conta' })

    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: 'Desativar conta' })).toBeDisabled()
  })

  it('conta excluída: sem ações (critério 16)', async () => {
    jest.mocked(buscarUsuario).mockResolvedValue(
      detalhe({
        nome: 'Conta anonimizada',
        situacao: 'EXCLUIDO',
        times: [],
        permissoes: {
          podeAlterarSituacao: false,
          motivoBloqueio: 'Este usuário excluiu a conta.',
          podeAlterarPapel: false,
          ehUltimoAdministrador: false,
        },
      }),
    )
    await renderizar(<DetalheUsuario id={ID} />)

    expect(await screen.findByText('Usuário excluído')).toBeOnTheScreen()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
