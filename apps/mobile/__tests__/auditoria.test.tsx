import type {
  ListaAuditoria as ListaAuditoriaDto,
  RegistroAuditoriaDetalhe,
  RegistroAuditoriaResumo,
} from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { buscarRegistroAuditoria, listarAuditoria } from '@/features/auditoria/api'
import { DetalheAuditoria, lerParametros, ListaAuditoria } from '@/features/auditoria'
import {
  dataDigitadaParaIso,
  FILTROS_PADRAO,
  filtrosAtivos,
  paraConsulta,
  type FiltrosTela,
} from '@/features/auditoria/filtros'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/features/auditoria/api', () => ({
  LIMITE_PAGINA: 20,
  listarAuditoria: jest.fn(),
  buscarRegistroAuditoria: jest.fn(),
}))

const ID = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const EVENTO = '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b'

const registro = (parcial: Partial<RegistroAuditoriaResumo> = {}): RegistroAuditoriaResumo => ({
  id: ID,
  acao: 'RESULTADO_CORRIGIDO',
  entidade: 'Evento',
  entidadeId: EVENTO,
  rotuloRegistro: 'Jogo Futsal 12/10/2026 19:00',
  autor: { id: EVENTO, nome: 'Ana Souza', anonimizado: false },
  criadoEm: '2026-10-12T23:40:00.000Z',
  ...parcial,
})

const lista = (items: RegistroAuditoriaResumo[]): ListaAuditoriaDto => ({
  items,
  page: 1,
  limit: 20,
  total: items.length,
})

let cliente: QueryClient

function renderizar(elemento: React.ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
})

afterEach(() => cliente.clear())

describe('filtros da auditoria', () => {
  it('parâmetros inválidos valem como sem filtro; registro só com entidade', () => {
    expect(
      lerParametros({ entidade: 'Sessao', entidadeId: ID, usuarioId: 'x', periodo: '5' }),
    ).toEqual({ ...FILTROS_PADRAO, entidadeId: undefined, usuarioNome: undefined })
    expect(lerParametros({ entidade: 'Evento', entidadeId: EVENTO })).toMatchObject({
      entidade: 'Evento',
      entidadeId: EVENTO,
      periodo: '30',
    })
    expect(lerParametros({ periodo: 'PERSONALIZADO' }).periodo).toBe('30')
  })

  it('atalhos de período contam o dia de hoje; personalizado envia as datas', () => {
    expect(paraConsulta(FILTROS_PADRAO, '2026-10-08')).toMatchObject({ de: '2026-09-09' })
    expect(paraConsulta({ periodo: '7' }, '2026-10-08')).toMatchObject({ de: '2026-10-02' })
    const personalizado: FiltrosTela = {
      periodo: 'PERSONALIZADO',
      de: '2026-09-01',
      ate: '2026-09-15',
    }
    expect(paraConsulta(personalizado)).toMatchObject({ de: '2026-09-01', ate: '2026-09-15' })
    expect(filtrosAtivos(personalizado)).toEqual([
      { chave: 'periodo', rotulo: '01/09/2026 a 15/09/2026' },
    ])
  })

  it('data digitada', () => {
    expect(dataDigitadaParaIso('01/09/2026')).toBe('2026-09-01')
    expect(dataDigitadaParaIso('31/02/2026')).toBeNull()
    expect(dataDigitadaParaIso('01/09')).toBeNull()
  })
})

describe('Lista da auditoria', () => {
  it('mostra ação legível, registro, autor e data; ator null é "Sistema"', async () => {
    jest.mocked(listarAuditoria).mockResolvedValue(
      lista([
        registro(),
        registro({
          id: EVENTO,
          acao: 'CONTA_EXCLUIDA',
          entidade: 'Usuario',
          rotuloRegistro: null,
          autor: null,
        }),
      ]),
    )
    const aoAbrir = jest.fn()
    await renderizar(
      <ListaAuditoria filtros={FILTROS_PADRAO} aoMudarFiltros={jest.fn()} aoAbrir={aoAbrir} />,
    )
    expect(await screen.findByText('Resultado corrigido')).toBeOnTheScreen()
    expect(screen.getByText('Evento · Jogo Futsal 12/10/2026 19:00')).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza · 12/10/2026 20:40')).toBeOnTheScreen()
    expect(screen.getByText('Sistema · 12/10/2026 20:40')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: /^Resultado corrigido/ }))
    expect(aoAbrir).toHaveBeenCalledWith(ID)
  })

  it('sem resultados oferece limpar filtros; chip remove o filtro', async () => {
    jest.mocked(listarAuditoria).mockResolvedValue(lista([]))
    const aoMudarFiltros = jest.fn()
    const filtros: FiltrosTela = { ...FILTROS_PADRAO, entidade: 'Evento', entidadeId: EVENTO }
    await renderizar(
      <ListaAuditoria filtros={filtros} aoMudarFiltros={aoMudarFiltros} aoAbrir={jest.fn()} />,
    )
    expect(
      await screen.findByText('Nenhum registro encontrado para os filtros escolhidos.'),
    ).toBeOnTheScreen()
    expect(listarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: 'Evento', entidadeId: EVENTO }),
      1,
      expect.anything(),
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Remover filtro Evento' }))
    expect(aoMudarFiltros).toHaveBeenLastCalledWith({
      ...filtros,
      entidade: undefined,
      entidadeId: undefined,
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(aoMudarFiltros).toHaveBeenLastCalledWith(FILTROS_PADRAO)
  })
})

describe('Detalhe da auditoria', () => {
  const detalhe = (parcial: Partial<RegistroAuditoriaDetalhe> = {}): RegistroAuditoriaDetalhe => ({
    ...registro(),
    dados: {
      antes: { placarTime: 2, resultado: 'EMPATE' },
      depois: { placarTime: 3, resultado: 'VITORIA' },
      contexto: { usuarioId: ID },
    },
    referencias: { [ID]: 'José Lima' },
    ...parcial,
  })

  it('tabela Campo · Antes · Depois e contexto com ids resolvidos', async () => {
    jest.mocked(buscarRegistroAuditoria).mockResolvedValue(detalhe())
    await renderizar(<DetalheAuditoria id={ID} />)
    expect(await screen.findByText('Placar da atlética')).toBeOnTheScreen()
    expect(screen.getByLabelText('Antes: 2')).toBeOnTheScreen()
    expect(screen.getByLabelText('Depois: 3')).toBeOnTheScreen()
    expect(screen.getByLabelText('Antes: Empate')).toBeOnTheScreen()
    expect(screen.getByLabelText('Depois: Vitória')).toBeOnTheScreen()
    expect(screen.getByText('José Lima')).toBeOnTheScreen()
  })

  it('autor anonimizado e dados fora do formato viram JSON', async () => {
    jest.mocked(buscarRegistroAuditoria).mockResolvedValue(
      detalhe({
        autor: { id: ID, nome: 'Usuário excluído', anonimizado: true },
        dados: { legado: true },
      }),
    )
    await renderizar(<DetalheAuditoria id={ID} />)
    expect(await screen.findByText('Usuário excluído')).toBeOnTheScreen()
    expect(screen.getByText(/"legado": true/)).toBeOnTheScreen()
  })
})
