import type {
  ListaNoticias,
  ListaTags,
  NoticiaDetalheDto,
  NoticiaResumoDto,
  TagDto,
} from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState, type ReactNode } from 'react'
import { ListaNoticias as TelaLista, TelaNoticia } from '@/features/noticias'
import { buscarNoticia, listarNoticias } from '@/features/noticias/api'
import { CampoTags } from '@/features/noticias/tags'
import { listarTags } from '@/features/noticias/tags/api'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/features/noticias/api', () => ({
  LIMITE_PAGINA: 20,
  listarNoticias: jest.fn(),
  buscarNoticia: jest.fn(),
}))

jest.mock('@/features/noticias/tags/api', () => ({ listarTags: jest.fn() }))

const FUTSAL: TagDto = {
  id: 'd2f1a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
  nome: 'Futsal',
  totalNoticias: 2,
}
const SELETIVA: TagDto = {
  id: 'e3a2b4c5-6d7e-4f80-9b1c-2d3e4f5a6b7c',
  nome: 'Seletiva',
  totalNoticias: 1,
}

const tags = (items: TagDto[]): ListaTags => ({ items, page: 1, limit: 50, total: items.length })

const resumo = (id: string, parcial: Partial<NoticiaResumoDto> = {}): NoticiaResumoDto => ({
  id,
  titulo: `Notícia ${id}`,
  imagemCapaUrl: null,
  publicadaEm: '2026-09-28T18:00:00.000Z',
  resumo: 'Resumo.',
  tags: [],
  ...parcial,
})

const pagina = (items: NoticiaResumoDto[]): ListaNoticias => ({
  items,
  page: 1,
  limit: 20,
  total: items.length,
})

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = (elemento: React.ReactElement) => render(elemento, { wrapper: Provedor })

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.mocked(listarNoticias).mockReset()
  jest.mocked(buscarNoticia).mockReset()
  jest
    .mocked(listarTags)
    .mockReset()
    .mockResolvedValue(tags([FUTSAL, SELETIVA]))
})

afterEach(() => {
  cliente.clear()
})

describe('CampoTags', () => {
  const aoMudar = jest.fn()

  function Campo({ inicial = [] }: { inicial?: string[] }) {
    const [valor, setValor] = useState(inicial)
    return (
      <CampoTags
        valor={valor}
        aoMudar={(novas) => {
          aoMudar(novas)
          setValor(novas)
        }}
      />
    )
  }

  const campo = () => screen.getByLabelText('Adicionar tag')

  beforeEach(() => aoMudar.mockReset())

  it('sugere tags existentes, inclusive sem uso, e adiciona ao tocar', async () => {
    jest.mocked(listarTags).mockResolvedValue(tags([FUTSAL]))
    await renderizar(<Campo />)

    await fireEvent.changeText(campo(), 'fut')
    await fireEvent.press(await screen.findByRole('button', { name: 'Futsal' }))

    expect(listarTags).toHaveBeenCalledWith({ emUso: false, q: 'fut' }, expect.anything())
    expect(aoMudar).toHaveBeenLastCalledWith(['Futsal'])
    expect(screen.getByRole('button', { name: 'Remover tag Futsal' })).toBeOnTheScreen()
  })

  it('"Enter" cria a tag nova, com espaços normalizados', async () => {
    await renderizar(<Campo />)

    await fireEvent.changeText(campo(), '  Vôlei   Feminino ')
    await fireEvent(campo(), 'submitEditing')

    expect(aoMudar).toHaveBeenLastCalledWith(['Vôlei Feminino'])
    expect(campo().props.value).toBe('')
  })

  it('"Adicionar \'texto\'" quando não há sugestão igual', async () => {
    jest.mocked(listarTags).mockResolvedValue(tags([]))
    await renderizar(<Campo />)

    await fireEvent.changeText(campo(), 'Calouros')
    await fireEvent.press(screen.getByRole('button', { name: "Adicionar 'Calouros'" }))

    expect(aoMudar).toHaveBeenLastCalledWith(['Calouros'])
  })

  it('não repete a mesma tag com outra caixa ou acento', async () => {
    await renderizar(<Campo inicial={['Vôlei']} />)

    await fireEvent.changeText(campo(), 'VOLEI')
    await fireEvent(campo(), 'submitEditing')

    expect(aoMudar).not.toHaveBeenCalled()
  })

  it.each([
    ['a', 'A tag deve ter ao menos 2 caracteres.'],
    ['<b>', 'Use só letras, números, espaço e hífen.'],
  ])('formato inválido %j: mostra o erro e não adiciona', async (texto, mensagem) => {
    await renderizar(<Campo />)

    await fireEvent.changeText(campo(), texto)
    await fireEvent(campo(), 'submitEditing')

    expect(screen.getByText(mensagem)).toBeOnTheScreen()
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('bloqueia a 6ª tag com "Máximo de 5 tags"', async () => {
    await renderizar(<Campo inicial={['aa', 'bb', 'cc', 'dd', 'ee']} />)

    await fireEvent.changeText(campo(), 'ff')
    await fireEvent(campo(), 'submitEditing')

    expect(screen.getAllByText('Máximo de 5 tags').length).toBeGreaterThan(0)
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('remove pelo "x" do chip', async () => {
    await renderizar(<Campo inicial={['Futsal', 'Seletiva']} />)

    await fireEvent.press(screen.getByRole('button', { name: 'Remover tag Futsal' }))

    expect(aoMudar).toHaveBeenLastCalledWith(['Seletiva'])
  })
})

describe('Lista de notícias com filtro por tag', () => {
  it('chips "Todas" + tags em uso; tocar numa tag filtra (critério 9)', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a')]))
    const aoFiltrar = jest.fn()
    await renderizar(<TelaLista aoAbrir={jest.fn()} aoFiltrar={aoFiltrar} />)

    expect(await screen.findByRole('radio', { name: 'Todas' })).toBeOnTheScreen()
    expect(listarTags).toHaveBeenCalledWith({ emUso: true }, expect.anything())
    await fireEvent.press(screen.getByRole('radio', { name: 'Futsal' }))

    expect(aoFiltrar).toHaveBeenCalledWith(FUTSAL)
  })

  it('com filtro: consulta por tagId e marca o chip', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a', { tags: [FUTSAL] })]))
    await renderizar(
      <TelaLista filtro={{ id: FUTSAL.id }} aoAbrir={jest.fn()} aoFiltrar={jest.fn()} />,
    )

    expect(await screen.findByRole('radio', { name: 'Futsal' })).toBeSelected()
    expect(listarNoticias).toHaveBeenCalledWith(
      { page: 1, limit: 20, tagId: FUTSAL.id },
      expect.anything(),
    )
  })

  it('cards mostram até 3 tags e "+N"', async () => {
    const quatro = ['Alfa', 'Bravo', 'Charlie', 'Delta'].map((nome, i) => ({ id: `t${i}`, nome }))
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a', { tags: quatro })]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)

    expect(await screen.findByText('Charlie')).toBeOnTheScreen()
    expect(screen.queryByText('Delta')).toBeNull()
    expect(screen.getByText('+1')).toBeOnTheScreen()
  })

  it('sem resultados: mensagem com o nome e "Limpar filtro" (critério 10, UC05 A1)', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([]))
    jest.mocked(listarTags).mockResolvedValue(tags([]))
    const aoFiltrar = jest.fn()
    await renderizar(
      <TelaLista
        filtro={{ id: FUTSAL.id, nome: 'Futsal' }}
        aoAbrir={jest.fn()}
        aoFiltrar={aoFiltrar}
      />,
    )

    expect(await screen.findByText('Nenhuma notícia com a tag Futsal')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(aoFiltrar).toHaveBeenCalledWith(undefined)
  })

  it('chips ocultos sem tags em uso', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a')]))
    jest.mocked(listarTags).mockResolvedValue(tags([]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} aoFiltrar={jest.fn()} />)

    await screen.findByText('Notícia a')
    await waitFor(() => expect(listarTags).toHaveBeenCalled())
    expect(screen.queryByRole('radio', { name: 'Todas' })).toBeNull()
  })

  it('offline com a lista filtrada em cache: dados e "Modo offline" (critério 14)', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a', { tags: [FUTSAL] })]))
    await renderizar(
      <TelaLista filtro={{ id: FUTSAL.id }} aoAbrir={jest.fn()} aoFiltrar={jest.fn()} />,
    )
    await screen.findByText('Notícia a')

    await act(() => onlineManager.setOnline(false))

    expect(screen.getByText(/^Modo offline · dados de/)).toBeOnTheScreen()
    expect(screen.getByText('Notícia a')).toBeOnTheScreen()
  })
})

describe('Detalhe da notícia', () => {
  const detalhe: NoticiaDetalheDto = {
    id: 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b',
    titulo: 'Seletiva de futsal',
    conteudo: 'Inscrições abertas.',
    imagemCapaUrl: null,
    publicadaEm: '2026-09-28T18:00:00.000Z',
    tags: [FUTSAL, SELETIVA],
  }

  it('todas as tags; tocar abre a lista filtrada (critério 11)', async () => {
    jest.mocked(buscarNoticia).mockResolvedValue(detalhe)
    const aoAbrirTag = jest.fn()
    await renderizar(<TelaNoticia id={detalhe.id} aoAbrirTag={aoAbrirTag} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Ver notícias com a tag Seletiva' }),
    )

    expect(aoAbrirTag).toHaveBeenCalledWith(SELETIVA)
    expect(screen.getByText('Futsal')).toBeOnTheScreen()
  })
})
