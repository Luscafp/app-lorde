import type { ListaNoticias, NoticiaDetalheDto, NoticiaResumoDto } from '@atletica/shared'
import {
  onlineManager,
  QueryClientProvider,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'
import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { ConteudoMarkdown } from '@/components/markdown'
import { COR_NEUTRA } from '@/features/atletica/use-atletica'
import { ListaNoticias as TelaLista, NoticiaCard, TelaNoticia } from '@/features/noticias'
import { buscarNoticia, listarNoticias } from '@/features/noticias/api'
import { juntarPaginas, useNoticias } from '@/features/noticias/consultas'
import { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }))

jest.mock('@/features/noticias/api', () => ({
  LIMITE_PAGINA: 20,
  listarNoticias: jest.fn(),
  buscarNoticia: jest.fn(),
}))

const CAPA = 'https://img.exemplo.com/atleticas/a/noticias/u/capa.jpg'
const ID = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'

const resumo = (id: string, titulo = `Notícia ${id}`): NoticiaResumoDto => ({
  id,
  titulo,
  imagemCapaUrl: CAPA,
  publicadaEm: '2026-09-28T18:00:00.000Z',
  resumo: 'Resumo.',
})

const pagina = (items: NoticiaResumoDto[], page = 1, total = items.length): ListaNoticias => ({
  items,
  page,
  limit: 20,
  total,
})

const detalhe = (parcial: Partial<NoticiaDetalheDto> = {}): NoticiaDetalheDto => ({
  id: ID,
  titulo: 'Atlética é campeã',
  conteudo: 'A equipe **venceu** a final.',
  imagemCapaUrl: CAPA,
  publicadaEm: '2026-09-28T18:00:00.000Z',
  ...parcial,
})

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = (elemento: React.ReactElement) => render(elemento, { wrapper: Provedor })

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')))
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  jest.mocked(listarNoticias).mockReset()
  jest.mocked(buscarNoticia).mockReset()
})

afterEach(() => {
  cliente.clear()
})

describe('ConteudoMarkdown', () => {
  const estilo = (texto: string): TextStyle =>
    StyleSheet.flatten(screen.getByText(texto).props.style as StyleProp<TextStyle>)

  it('negrito e itálico', async () => {
    await renderizar(<ConteudoMarkdown conteudo="Texto **forte** e *leve*." />)
    expect(estilo('forte')).toMatchObject({ fontWeight: '700' })
    expect(estilo('leve')).toMatchObject({ fontStyle: 'italic' })
  })

  it('listas com e sem numeração', async () => {
    await renderizar(<ConteudoMarkdown conteudo={'- vôlei\n- futsal\n\n1. primeiro\n2. segundo'} />)
    for (const item of ['vôlei', 'futsal', 'primeiro', 'segundo']) {
      expect(screen.getByText(item)).toBeOnTheScreen()
    }
  })

  it('link https:// abre no navegador do sistema', async () => {
    await renderizar(<ConteudoMarkdown conteudo="Veja [o site](https://exemplo.com/a)." />)
    await fireEvent.press(screen.getByRole('link', { name: 'o site' }))
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://exemplo.com/a')
  })

  it('HTML bruto aparece como texto', async () => {
    await renderizar(<ConteudoMarkdown conteudo={'<b>oi</b> <script>alert(1)</script>'} />)
    expect(screen.getByText('<b>oi</b> <script>alert(1)</script>')).toBeOnTheScreen()
  })

  it.each([
    ['javascript:', '[clique](javascript:alert(1))', /clique/],
    ['http:', '[site](http://exemplo.com)', 'site'],
    ['esquema do app', '[app](atletica://perfil)', 'app'],
  ])('link %s não vira link', async (_, conteudo, texto) => {
    await renderizar(<ConteudoMarkdown conteudo={conteudo} />)
    expect(screen.getByText(texto)).toBeOnTheScreen()
    expect(screen.queryByRole('link')).toBeNull()
    await fireEvent.press(screen.getByText(texto))
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled()
  })

  it('títulos e imagens ficam fora do subconjunto', async () => {
    await renderizar(<ConteudoMarkdown conteudo={'# Título\n\n![capa](https://img/x.png)'} />)
    expect(screen.getByText('# Título')).toBeOnTheScreen()
    expect(screen.queryByRole('image')).toBeNull()
  })
})

describe('NoticiaCard', () => {
  it('capa com expo-image, título em 2 linhas e data dd/mm/aaaa', async () => {
    const aoAbrir = jest.fn()
    await renderizar(<NoticiaCard noticia={resumo('a', 'Campeões')} aoAbrir={aoAbrir} />)

    expect(screen.getByTestId('imagem').props).toMatchObject({
      source: { uri: CAPA },
      cachePolicy: 'memory-disk',
    })
    expect(screen.getByText('Campeões').props.numberOfLines).toBe(2)
    await fireEvent.press(screen.getByRole('button', { name: 'Campeões, 28/09/2026' }))
    expect(aoAbrir).toHaveBeenCalledWith('a')
  })

  it('sem capa: placeholder com a cor da atlética (critério 19)', async () => {
    await renderizar(
      <NoticiaCard noticia={{ ...resumo('a'), imagemCapaUrl: null }} aoAbrir={jest.fn()} />,
    )
    expect(screen.queryByTestId('imagem')).toBeNull()
    const placeholder = screen.getByTestId('capa-placeholder')
    expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
      backgroundColor: COR_NEUTRA,
    })
  })

  it('capa com erro de carregamento vira o placeholder', async () => {
    await renderizar(<NoticiaCard noticia={resumo('a')} aoAbrir={jest.fn()} />)
    await fireEvent(screen.getByTestId('imagem'), 'error')
    expect(screen.getByTestId('capa-placeholder')).toBeOnTheScreen()
  })

  it('publicada às 23:30 local de 28/09 (02:30Z de 29/09) mostra 28/09/2026', async () => {
    const noticia = { ...resumo('a', 'Tarde da noite'), publicadaEm: '2026-09-29T02:30:00.000Z' }
    await renderizar(<NoticiaCard noticia={noticia} aoAbrir={jest.fn()} />)
    expect(screen.getByText('28/09/2026')).toBeOnTheScreen()
  })
})

describe('useNoticias', () => {
  it('45 publicadas → 3 páginas (20, 20, 5) sem repetir ids', async () => {
    const todas = Array.from({ length: 45 }, (_, i) => resumo(`n${i}`))
    jest
      .mocked(listarNoticias)
      .mockImplementation((page, limit) =>
        Promise.resolve(pagina(todas.slice((page - 1) * limit, page * limit), page, 45)),
      )
    const { result } = await renderHook(() => useNoticias(), { wrapper: Provedor })

    await waitFor(() => expect(result.current.data).toHaveLength(20))
    await act(async () => void (await result.current.fetchNextPage()))
    await waitFor(() => expect(result.current.data).toHaveLength(40))
    await act(async () => void (await result.current.fetchNextPage()))
    await waitFor(() => expect(result.current.data).toHaveLength(45))

    expect(result.current.hasNextPage).toBe(false)
    expect(jest.mocked(listarNoticias).mock.calls.map(([page, limit]) => [page, limit])).toEqual([
      [1, 20],
      [2, 20],
      [3, 20],
    ])
  })

  it('juntarPaginas remove itens repetidos entre páginas', () => {
    const [a, b, c] = [resumo('a'), resumo('b'), resumo('c')]
    expect(juntarPaginas([{ items: [a, b] }, { items: [b, c] }]).map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})

describe('Lista de notícias', () => {
  it('mostra os cards e abre o detalhe', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a', 'Campeões')]))
    const aoAbrir = jest.fn()
    await renderizar(<TelaLista aoAbrir={aoAbrir} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Campeões, 28/09/2026' }))
    expect(aoAbrir).toHaveBeenCalledWith('a')
  })

  it('rolar até o fim carrega a próxima página', async () => {
    const primeira = Array.from({ length: 20 }, (_, i) => resumo(`n${i}`))
    jest
      .mocked(listarNoticias)
      .mockResolvedValueOnce(pagina(primeira, 1, 21))
      .mockResolvedValueOnce(pagina([resumo('ultima', 'Última')], 2, 21))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    await screen.findByText('Notícia n0')

    await fireEvent(screen.getByTestId('lista-noticias'), 'endReached')

    await waitFor(() => expect(listarNoticias).toHaveBeenLastCalledWith(2, 20, expect.anything()))
    await waitFor(() =>
      expect(
        cliente.getQueryData<InfiniteData<ListaNoticias>>(chaves.noticias.lista({ limit: 20 }))
          ?.pages,
      ).toHaveLength(2),
    )
  })

  it('vazio: "Nenhuma notícia publicada" (critério 12)', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    expect(await screen.findByText('Nenhuma notícia publicada')).toBeOnTheScreen()
  })

  it('erro: mensagem e "Tentar novamente" refaz a consulta', async () => {
    jest
      .mocked(listarNoticias)
      .mockRejectedValueOnce(new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }))
      .mockResolvedValue(pagina([resumo('a', 'Campeões')]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)

    expect(await screen.findByText('Não foi possível carregar.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Campeões')).toBeOnTheScreen()
  })

  it('offline com cache: dados e faixa "Modo offline"', async () => {
    jest.mocked(listarNoticias).mockResolvedValue(pagina([resumo('a', 'Campeões')]))
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    await screen.findByText('Campeões')

    await act(() => onlineManager.setOnline(false))

    expect(screen.getByText(/^Modo offline · dados de/)).toBeOnTheScreen()
    expect(screen.getByText('Campeões')).toBeOnTheScreen()
  })

  it('offline sem cache: "Sem conexão" + "Tentar novamente"', async () => {
    onlineManager.setOnline(false)
    await renderizar(<TelaLista aoAbrir={jest.fn()} />)
    expect(
      await screen.findByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })
})

describe('Detalhe da notícia', () => {
  it('capa, título, data e conteúdo renderizado (critério 10)', async () => {
    jest.mocked(buscarNoticia).mockResolvedValue(detalhe())
    await renderizar(<TelaNoticia id={ID} />)

    expect(await screen.findByRole('header', { name: 'Atlética é campeã' })).toBeOnTheScreen()
    expect(screen.getByText('28/09/2026')).toBeOnTheScreen()
    expect(screen.getByText('venceu')).toBeOnTheScreen()
    expect(screen.getByTestId('imagem').props.source).toEqual({ uri: CAPA })
  })

  it('sem capa mostra o placeholder', async () => {
    jest.mocked(buscarNoticia).mockResolvedValue(detalhe({ imagemCapaUrl: null }))
    await renderizar(<TelaNoticia id={ID} />)
    expect(await screen.findByTestId('capa-placeholder')).toBeOnTheScreen()
  })

  it('404 do cache: mensagem e remoção das listas em cache (critério 11)', async () => {
    const outra = resumo('outra')
    const infinita: InfiniteData<ListaNoticias> = {
      pages: [pagina([resumo(ID), outra], 1, 2)],
      pageParams: [1],
    }
    cliente.setQueryData(chaves.noticias.lista({ limit: 20 }), infinita)
    cliente.setQueryData(chaves.noticias.lista({ limit: 3 }), pagina([resumo(ID), outra]))
    cliente.setQueryData(chaves.noticias.detalhe(ID), detalhe())
    jest
      .mocked(buscarNoticia)
      .mockRejectedValue(new ApiErro({ status: 404, code: 'NOT_FOUND', message: 'x' }))

    await renderizar(<TelaNoticia id={ID} />)

    expect(await screen.findByText('Esta notícia não está mais disponível')).toBeOnTheScreen()
    expect(screen.queryByText('Atlética é campeã')).toBeNull()
    const completa = cliente.getQueryData<InfiniteData<ListaNoticias>>(
      chaves.noticias.lista({ limit: 20 }),
    )
    expect(completa?.pages[0]).toMatchObject({ items: [outra], total: 1 })
    expect(cliente.getQueryData(chaves.noticias.lista({ limit: 3 }))).toMatchObject({
      items: [outra],
      total: 1,
    })
  })

  it('erro que não é 404 mantém o estado de erro com "Tentar novamente"', async () => {
    jest
      .mocked(buscarNoticia)
      .mockRejectedValue(new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }))
    await renderizar(<TelaNoticia id={ID} />)
    expect(await screen.findByText('Não foi possível carregar.')).toBeOnTheScreen()
  })
})
