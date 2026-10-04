import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { EstadoErro, EstadoVazio, FaixaOffline, TelaDados } from '@/components/estado'

const ATUALIZADO_EM = Date.parse('2026-10-01T22:00:00.000Z')

function consulta<T>(parcial: { data?: T; isError?: boolean } = {}) {
  return {
    data: parcial.data,
    isError: parcial.isError ?? false,
    dataUpdatedAt: parcial.data === undefined ? 0 : ATUALIZADO_EM,
    refetch: jest.fn(),
  }
}

function renderizar(c: ReturnType<typeof consulta<string[]>>) {
  return render(
    <TelaDados consulta={c} vazio={(itens) => itens.length === 0} mensagemVazio="Nenhum evento">
      {(itens) => <Text>{itens.join(', ')}</Text>}
    </TelaDados>,
  )
}

afterEach(() => onlineManager.setOnline(true))

describe('FaixaOffline', () => {
  it('mostra a data em America/Fortaleza', async () => {
    await render(<FaixaOffline atualizadoEm={ATUALIZADO_EM} />)
    expect(screen.getByText('Modo offline · dados de 01/10/2026 19:00')).toBeOnTheScreen()
  })

  it('aceita Date', async () => {
    await render(<FaixaOffline atualizadoEm={new Date('2026-10-02T02:30:00.000Z')} />)
    expect(screen.getByText('Modo offline · dados de 01/10/2026 23:30')).toBeOnTheScreen()
  })

  it.each([undefined, 0])('sem data (%s) mostra só "Modo offline"', async (atualizadoEm) => {
    await render(<FaixaOffline atualizadoEm={atualizadoEm} />)
    expect(screen.getByText('Modo offline')).toBeOnTheScreen()
  })
})

describe('EstadoVazio e EstadoErro', () => {
  it('EstadoVazio mostra a mensagem e a ação', async () => {
    const onPress = jest.fn()
    await render(<EstadoVazio mensagem="Nenhum evento" acao={{ titulo: 'Criar', onPress }} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Criar' }))
    expect(screen.getByText('Nenhum evento')).toBeOnTheScreen()
    expect(onPress).toHaveBeenCalled()
  })

  it('EstadoErro usa a mensagem padrão', async () => {
    await render(<EstadoErro onTentarNovamente={jest.fn()} />)
    expect(screen.getByText('Não foi possível carregar.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })
})

describe('TelaDados', () => {
  it('carregando sem dados mostra o esqueleto', async () => {
    await renderizar(consulta())
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
  })

  it('offline sem dados mostra "Sem conexão" e tenta de novo', async () => {
    onlineManager.setOnline(false)
    const c = consulta<string[]>()
    await renderizar(c)

    expect(
      screen.getByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(c.refetch).toHaveBeenCalledTimes(1)
  })

  it('erro sem dados mostra EstadoErro e "Tentar novamente" chama refetch', async () => {
    const c = consulta<string[]>({ isError: true })
    await renderizar(c)

    expect(screen.getByText('Não foi possível carregar.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(c.refetch).toHaveBeenCalledTimes(1)
  })

  it('dados vazios mostram EstadoVazio', async () => {
    await renderizar(consulta({ data: [] }))
    expect(screen.getByText('Nenhum evento')).toBeOnTheScreen()
  })

  it('dados online mostram o conteúdo sem faixa', async () => {
    await renderizar(consulta({ data: ['Treino', 'Jogo'] }))
    expect(screen.getByText('Treino, Jogo')).toBeOnTheScreen()
    expect(screen.queryByText(/Modo offline/)).toBeNull()
  })

  it('dados com erro de atualização continuam visíveis', async () => {
    await renderizar(consulta({ data: ['Treino'], isError: true }))
    expect(screen.getByText('Treino')).toBeOnTheScreen()
  })

  it('dados offline mostram o conteúdo com a faixa e a data', async () => {
    onlineManager.setOnline(false)
    await renderizar(consulta({ data: ['Treino'] }))
    expect(screen.getByText('Treino')).toBeOnTheScreen()
    expect(screen.getByText('Modo offline · dados de 01/10/2026 19:00')).toBeOnTheScreen()
  })

  it('reage à mudança de conexão', async () => {
    await renderizar(consulta({ data: ['Treino'] }))
    await act(() => onlineManager.setOnline(false))
    expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
    await act(() => onlineManager.setOnline(true))
    expect(screen.queryByText(/Modo offline/)).toBeNull()
  })
})
