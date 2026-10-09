import type { BannerDto, BannerPainelDto, Papel } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import * as apiBanners from '@/features/banners/api'
import { CarrosselBanners, FormBanner, TelaBannersPainel } from '@/features/banners'
import { INTERVALO_CARROSSEL_MS } from '@/features/banners/carrossel-banners'
import { ApiErro } from '@/infra/api/api-erro'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/banners/api')
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }))
/** O `SeletorImagem` real é testado na #55; aqui só importa o contrato com o formulário. */
jest.mock('@/components/imagem', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    ...jest.requireActual<object>('@/components/imagem'),
    SeletorImagem: function SeletorFalso({ onChange }: { onChange: (key: string | null) => void }) {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('atleticas/a1/banners/u1/nova.webp')}
        >
          <Text>Concluir envio</Text>
        </Pressable>
      )
    },
  }
})

const api = jest.mocked(apiBanners)

const banner = (id: string, parcial: Partial<BannerDto> = {}): BannerDto => ({
  id,
  titulo: `Banner ${id}`,
  imagemUrl: `https://img/${id}.webp`,
  link: null,
  ...parcial,
})

const bannerPainel = (id: string, parcial: Partial<BannerPainelDto> = {}): BannerPainelDto => ({
  ...banner(id),
  ordem: 0,
  ativo: true,
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  ...parcial,
})

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
  comPapel('DIRETOR')
})

afterEach(() => {
  cliente.clear()
  jest.useRealTimers()
})

describe('CarrosselBanners', () => {
  it('sem banners não renderiza nada', async () => {
    api.listarBanners.mockResolvedValue([])
    await renderizar(<CarrosselBanners />)
    await waitFor(() => expect(api.listarBanners).toHaveBeenCalled())
    expect(screen.queryByTestId('carrossel-banners')).toBeNull()
  })

  it('um banner: sem indicadores', async () => {
    api.listarBanners.mockResolvedValue([banner('a')])
    await renderizar(<CarrosselBanners />)
    expect(await screen.findByText('Banner a')).toBeOnTheScreen()
    expect(screen.queryAllByTestId('indicador-banner')).toHaveLength(0)
  })

  it('três banners na ordem da API, com três indicadores', async () => {
    api.listarBanners.mockResolvedValue([banner('a'), banner('b'), banner('c')])
    await renderizar(<CarrosselBanners />)
    await screen.findByText('Banner a')
    expect(screen.getAllByText(/^Banner /).map(({ props }) => props.children as string)).toEqual([
      'Banner a',
      'Banner b',
      'Banner c',
    ])
    expect(screen.getAllByTestId('indicador-banner')).toHaveLength(3)
    expect(screen.getByLabelText('Banner 1 de 3')).toBeOnTheScreen()
  })

  it('troca sozinho a cada 5 s', async () => {
    jest.useFakeTimers()
    api.listarBanners.mockResolvedValue([banner('a'), banner('b')])
    await renderizar(<CarrosselBanners />)
    await screen.findByText('Banner a')

    await act(() => jest.advanceTimersByTime(INTERVALO_CARROSSEL_MS))

    expect(screen.getByLabelText('Banner 2 de 2')).toBeOnTheScreen()
  })

  it('com link: abre no navegador interno (critério 2)', async () => {
    api.listarBanners.mockResolvedValue([banner('a', { link: 'https://exemplo.com' })])
    await renderizar(<CarrosselBanners />)

    await fireEvent.press(await screen.findByRole('link', { name: 'Banner a' }))

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://exemplo.com')
  })

  it('sem link: não é tocável e nada abre (critério 3)', async () => {
    api.listarBanners.mockResolvedValue([banner('a')])
    await renderizar(<CarrosselBanners />)
    await screen.findByText('Banner a')

    expect(screen.queryByRole('link')).toBeNull()
    await fireEvent.press(screen.getByTestId('banner-a'))
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled()
  })
})

describe('FormBanner', () => {
  it('link http mostra o erro de HTTPS e não envia (critério 5)', async () => {
    await renderizar(<FormBanner aoConcluir={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir envio' }))
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Inscrições JUBS')
    await fireEvent.changeText(screen.getByLabelText('Link (opcional)'), 'http://exemplo.com')

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('O link deve começar com https://')).toBeOnTheScreen()
    expect(api.criarBanner).not.toHaveBeenCalled()
  })

  it('sem imagem no cadastro: erro no campo', async () => {
    await renderizar(<FormBanner aoConcluir={jest.fn()} />)
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Inscrições JUBS')

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Escolha a imagem do banner.')).toBeOnTheScreen()
    expect(api.criarBanner).not.toHaveBeenCalled()
  })

  it('cadastra com título, imagem e sem link (critério 6)', async () => {
    api.criarBanner.mockResolvedValue(bannerPainel('n'))
    const aoConcluir = jest.fn()
    await renderizar(<FormBanner aoConcluir={aoConcluir} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir envio' }))
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Inscrições JUBS')

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoConcluir).toHaveBeenCalled())
    expect(api.criarBanner).toHaveBeenCalledWith({
      titulo: 'Inscrições JUBS',
      imagemKey: 'atleticas/a1/banners/u1/nova.webp',
      link: null,
      ativo: true,
    })
  })

  it('edição envia só os campos alterados', async () => {
    api.atualizarBanner.mockResolvedValue(bannerPainel('a'))
    await renderizar(
      <FormBanner
        banner={bannerPainel('a', { link: 'https://exemplo.com' })}
        aoConcluir={jest.fn()}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText('Link (opcional)'), '')

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(api.atualizarBanner).toHaveBeenCalledWith('a', { link: null }))
  })

  it('erro de limite de ativos vai para o campo', async () => {
    api.criarBanner.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'LIMITE_BANNERS_ATIVOS',
        message: 'Já existem 10 banners ativos. Desative um antes.',
        details: [{ field: 'ativo', message: 'Já existem 10 banners ativos. Desative um antes.' }],
      }),
    )
    await renderizar(<FormBanner aoConcluir={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir envio' }))
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Inscrições JUBS')

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Já existem 10 banners ativos. Desative um antes.'),
    ).toBeOnTheScreen()
  })
})

describe('TelaBannersPainel', () => {
  const ir = { novo: jest.fn(), editar: jest.fn() }

  it('vazio: mensagem e botão Novo banner', async () => {
    api.listarBannersPainel.mockResolvedValue([])
    await renderizar(<TelaBannersPainel ir={ir} />)
    expect(await screen.findByText('Nenhum banner cadastrado')).toBeOnTheScreen()
  })

  it('mostra ativos e inativos com a situação', async () => {
    api.listarBannersPainel.mockResolvedValue([
      bannerPainel('a'),
      bannerPainel('b', { ativo: false, link: 'https://exemplo.com' }),
    ])
    await renderizar(<TelaBannersPainel ir={ir} />)
    expect(await screen.findByText('Ativo')).toBeOnTheScreen()
    expect(screen.getByText('Inativo')).toBeOnTheScreen()
    expect(screen.getByText('https://exemplo.com')).toBeOnTheScreen()
  })

  it('botão Excluir só para a Presidência (critério 10)', async () => {
    api.listarBannersPainel.mockResolvedValue([bannerPainel('a')])
    await renderizar(<TelaBannersPainel ir={ir} />)
    await screen.findByText('Banner a')
    expect(screen.queryByRole('button', { name: 'Excluir Banner a' })).toBeNull()

    await act(() => comPapel('PRESIDENTE'))
    expect(screen.getByRole('button', { name: 'Excluir Banner a' })).toBeOnTheScreen()
  })

  it('Presidência confirma e exclui (critério 11)', async () => {
    comPapel('PRESIDENTE')
    api.listarBannersPainel.mockResolvedValue([bannerPainel('a')])
    api.excluirBanner.mockResolvedValue()
    await renderizar(<TelaBannersPainel ir={ir} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir Banner a' }))
    await confirmarAlerta('Excluir')

    expect(api.excluirBanner).toHaveBeenCalledWith('a')
  })

  it('move o último para o topo e salva a ordem de uma vez (critério 8)', async () => {
    api.listarBannersPainel.mockResolvedValue([
      bannerPainel('a'),
      bannerPainel('b'),
      bannerPainel('c'),
    ])
    api.ordenarBanners.mockResolvedValue([])
    await renderizar(<TelaBannersPainel ir={ir} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Subir Banner c' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Subir Banner c' }))
    expect(api.ordenarBanners).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar ordem' }))

    await waitFor(() => expect(api.ordenarBanners).toHaveBeenCalledWith(['c', 'a', 'b']))
  })

  it('desativa pelo interruptor (critério 9)', async () => {
    api.listarBannersPainel.mockResolvedValue([bannerPainel('a')])
    api.atualizarBanner.mockResolvedValue(bannerPainel('a', { ativo: false }))
    await renderizar(<TelaBannersPainel ir={ir} />)

    await fireEvent(await screen.findByLabelText('Ativo: Banner a'), 'valueChange', false)

    await waitFor(() => expect(api.atualizarBanner).toHaveBeenCalledWith('a', { ativo: false }))
  })
})
