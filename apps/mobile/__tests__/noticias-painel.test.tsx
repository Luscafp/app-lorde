import type { NoticiaPainelDetalheDto, Papel } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useNavigation } from 'expo-router'
import type { ReactElement } from 'react'
import { Alert } from 'react-native'
import EditarNoticia from '../app/(app)/(abas)/painel/noticias/[id]/index'
import NoticiasPainel from '../app/(app)/(abas)/painel/noticias/index'
import NovaNoticia from '../app/(app)/(abas)/painel/noticias/nova'
import { toast } from '@/components/ui/toast'
import { NoticiaDetalhe } from '@/features/noticias/components/noticia-detalhe'
import * as apiPainel from '@/features/noticias/painel/api'
import { aplicarMarcacao, type Marcacao, type Selecao } from '@/features/noticias/painel/marcacao'
import { ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

const ID = 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const CHAVE_NOVA = 'atleticas/a1/noticias/u1/nova.jpg'
const URI_LOCAL = 'file:///cache/nova.jpg'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/noticias/painel/api', () => ({
  ...jest.requireActual<object>('@/features/noticias/painel/api'),
  listarNoticiasPainel: jest.fn(),
  buscarNoticiaPainel: jest.fn(),
  criarNoticia: jest.fn(),
  atualizarNoticia: jest.fn(),
  publicarNoticia: jest.fn(),
  despublicarNoticia: jest.fn(),
  excluirNoticia: jest.fn(),
}))
jest.mock('@/features/noticias/tags/api', () => ({
  listarTags: jest.fn(() => Promise.resolve({ items: [], page: 1, limit: 50, total: 0 })),
}))
jest.mock('@/features/noticias/components/noticia-detalhe', () => ({
  NoticiaDetalhe: jest.fn(() => null),
}))
jest.mock('expo-router', () => {
  const navegacao = { addListener: jest.fn(() => jest.fn()), dispatch: jest.fn() }
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({ id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' }),
    useNavigation: () => navegacao,
  }
})
/** O `SeletorImagem` real é testado na #55; aqui só importa o contrato com o formulário. */
jest.mock('@/components/imagem', () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    ...jest.requireActual<object>('@/components/imagem'),
    SeletorImagem: function SeletorFalso({
      valorAtualUrl,
      onChange,
      onMudarEnviando,
      onMudarImagem,
      mensagemImagemInvalida,
    }: {
      valorAtualUrl?: string | null
      onChange: (key: string | null) => void
      onMudarEnviando?: (enviando: boolean) => void
      onMudarImagem?: (uri: string | null) => void
      mensagemImagemInvalida?: string
    }) {
      const { useState } = jest.requireActual<typeof import('react')>('react')
      const [erro, setErro] = useState<string>()
      return (
        <View>
          <Text>{valorAtualUrl ?? 'sem capa'}</Text>
          {erro && <Text>{erro}</Text>}
          <Pressable accessibilityRole="button" onPress={() => onMudarEnviando?.(true)}>
            <Text>Iniciar envio</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onChange('atleticas/a1/noticias/u1/nova.jpg')
              onMudarImagem?.('file:///cache/nova.jpg')
              onMudarEnviando?.(false)
            }}
          >
            <Text>Concluir envio</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setErro(mensagemImagemInvalida)
              onMudarEnviando?.(false)
            }}
          >
            <Text>Falhar envio</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onChange(null)
              onMudarImagem?.(null)
            }}
          >
            <Text>Remover capa</Text>
          </Pressable>
        </View>
      )
    },
  }
})

const api = jest.mocked(apiPainel)

const RASCUNHO: NoticiaPainelDetalheDto = {
  id: ID,
  titulo: 'Seletiva de futsal',
  conteudo: 'Inscrições até **sexta**.',
  status: 'RASCUNHO',
  imagemCapaUrl: 'https://img.exemplo/atleticas/a1/noticias/capa.jpg',
  publicadaEm: null,
  criadoEm: '2026-09-29T12:00:00.000Z',
  atualizadoEm: '2026-09-30T13:30:00.000Z',
  autor: { id: 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f', nome: 'Maria Diretora' },
  tags: [],
}

const PUBLICADA: NoticiaPainelDetalheDto = {
  ...RASCUNHO,
  status: 'PUBLICADA',
  publicadaEm: '2026-09-30T15:00:00.000Z',
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

function ultimoAlerta() {
  const [titulo, mensagem, botoes] = jest.mocked(Alert.alert).mock.lastCall ?? []
  return { titulo, mensagem, botoes }
}

async function confirmarAlerta(texto: string) {
  await act(() =>
    ultimoAlerta()
      .botoes?.find((botao) => botao.text === texto)
      ?.onPress?.(),
  )
}

const botao = (nome: string) => screen.getByRole('button', { name: nome })

async function preencher(titulo: string, conteudo?: string) {
  await fireEvent.changeText(screen.getByLabelText('Título'), titulo)
  if (conteudo !== undefined)
    await fireEvent.changeText(screen.getByLabelText('Conteúdo'), conteudo)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  comPapel('DIRETOR')
  api.listarNoticiasPainel.mockResolvedValue(pagina([PUBLICADA]))
  api.buscarNoticiaPainel.mockResolvedValue(RASCUNHO)
})

afterEach(() => cliente.clear())

describe('Nova notícia', () => {
  it('mostra os contadores de título e conteúdo', async () => {
    await renderizar(<NovaNoticia />)
    expect(screen.getByText('0/120')).toBeOnTheScreen()
    expect(screen.getByText('0/10.000')).toBeOnTheScreen()

    await preencher('Seletiva de futsal', 'Inscrições abertas')
    expect(screen.getByText('18/120')).toBeOnTheScreen()
    expect(screen.getByText('18/10.000')).toBeOnTheScreen()
  })

  it('salva rascunho só com o título', async () => {
    api.criarNoticia.mockResolvedValue(RASCUNHO)
    await renderizar(<NovaNoticia />)
    expect(screen.queryByRole('button', { name: 'Despublicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull()

    await preencher('  Seletiva de futsal ')
    await fireEvent.press(botao('Salvar rascunho'))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Rascunho salvo'))
    expect(api.criarNoticia).toHaveBeenCalledWith({
      titulo: 'Seletiva de futsal',
      conteudo: '',
      publicar: false,
    })
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('envia as tags do CampoTags na criação (RF10)', async () => {
    api.criarNoticia.mockResolvedValue(RASCUNHO)
    await renderizar(<NovaNoticia />)

    await preencher('Seletiva de futsal')
    for (const tag of ['Futsal', 'Seletiva']) {
      await fireEvent.changeText(screen.getByLabelText('Adicionar tag'), tag)
      await fireEvent(screen.getByLabelText('Adicionar tag'), 'submitEditing')
    }
    await fireEvent.press(botao('Salvar rascunho'))

    await waitFor(() =>
      expect(api.criarNoticia).toHaveBeenCalledWith({
        titulo: 'Seletiva de futsal',
        conteudo: '',
        tags: ['Futsal', 'Seletiva'],
        publicar: false,
      }),
    )
  })

  it('valida a publicação antes de chamar a API', async () => {
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal', '   ')
    await fireEvent.press(botao('Publicar'))

    expect(await screen.findByText('Escreva o conteúdo para publicar.')).toBeOnTheScreen()
    expect(screen.getByText('Escolha a imagem de capa para publicar.')).toBeOnTheScreen()
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(api.criarNoticia).not.toHaveBeenCalled()
  })

  it('publica com confirmação, já com a capa enviada', async () => {
    api.criarNoticia.mockResolvedValue(PUBLICADA)
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal', 'Inscrições abertas')
    await fireEvent.press(botao('Concluir envio'))
    await fireEvent.press(botao('Publicar'))

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    expect(ultimoAlerta()).toMatchObject({
      titulo: 'Publicar agora?',
      mensagem: 'A notícia aparecerá na Home para todos os usuários.',
    })
    expect(api.criarNoticia).not.toHaveBeenCalled()

    await confirmarAlerta('Publicar')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Notícia publicada'))
    expect(api.criarNoticia).toHaveBeenCalledWith({
      titulo: 'Seletiva de futsal',
      conteudo: 'Inscrições abertas',
      imagemCapaKey: CHAVE_NOVA,
      publicar: true,
    })
  })

  it('upload em andamento bloqueia salvar e publicar', async () => {
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal')
    await fireEvent.press(botao('Iniciar envio'))

    expect(botao('Salvar rascunho')).toBeDisabled()
    expect(botao('Publicar')).toBeDisabled()

    await fireEvent.press(botao('Concluir envio'))
    expect(botao('Salvar rascunho')).toBeEnabled()
    expect(botao('Publicar')).toBeEnabled()
  })

  it('imagem inválida no seletor mostra a mensagem da capa e mantém o formulário', async () => {
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal', 'Inscrições abertas')
    await fireEvent.press(botao('Iniciar envio'))
    await fireEvent.press(botao('Falhar envio'))

    expect(screen.getByText('Imagem inválida ou maior que 5 MB')).toBeOnTheScreen()
    expect(screen.getByLabelText('Título')).toHaveDisplayValue('Seletiva de futsal')
    expect(screen.getByLabelText('Conteúdo')).toHaveDisplayValue('Inscrições abertas')
    expect(botao('Salvar rascunho')).toBeEnabled()
    expect(api.criarNoticia).not.toHaveBeenCalled()
  })

  it.each([
    ['UPLOAD_INVALIDO', 'Imagem inválida. Envie a imagem novamente.'],
    ['UPLOAD_NAO_ENCONTRADO', 'O envio da imagem não foi concluído. Tente novamente.'],
  ])('422 %s aparece junto à capa e mantém o formulário', async (code, mensagem) => {
    api.criarNoticia.mockRejectedValue(new ApiErro({ status: 422, code, message: mensagem }))
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal', 'Inscrições abertas')
    await fireEvent.press(botao('Concluir envio'))
    await fireEvent.press(botao('Salvar rascunho'))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título')).toHaveDisplayValue('Seletiva de futsal')
    expect(screen.getByLabelText('Conteúdo')).toHaveDisplayValue('Inscrições abertas')
  })

  it('400 VALIDATION_ERROR aparece no campo e mantém os dados', async () => {
    const mensagem = 'O título deve ter no máximo 120 caracteres.'
    api.criarNoticia.mockRejectedValue(
      new ApiErro({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: [{ field: 'titulo', message: mensagem }],
      }),
    )
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal')
    await fireEvent.press(botao('Salvar rascunho'))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título')).toHaveDisplayValue('Seletiva de futsal')
  })

  it('offline: ações desabilitadas e nenhuma requisição', async () => {
    onlineManager.setOnline(false)
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal')

    expect(botao('Salvar rascunho')).toBeDisabled()
    expect(botao('Publicar')).toBeDisabled()
    await fireEvent.press(botao('Salvar rascunho'))
    expect(api.criarNoticia).not.toHaveBeenCalled()
  })

  it('a barra de Markdown envolve o trecho selecionado', async () => {
    await renderizar(<NovaNoticia />)
    const conteudo = screen.getByLabelText('Conteúdo')
    await fireEvent.changeText(conteudo, 'Inscrições abertas')
    await fireEvent(conteudo, 'selectionChange', {
      nativeEvent: { selection: { start: 0, end: 'Inscrições'.length } },
    })
    await fireEvent.press(botao('Negrito'))
    expect(conteudo).toHaveDisplayValue('**Inscrições** abertas')

    await fireEvent(conteudo, 'selectionChange', {
      nativeEvent: { selection: { start: 0, end: 0 } },
    })
    await fireEvent.press(botao('Lista'))
    expect(conteudo).toHaveDisplayValue('- **Inscrições** abertas')
  })
})

describe('Editar notícia', () => {
  it('rascunho: Salvar rascunho e Publicar', async () => {
    await renderizar(<EditarNoticia />)
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeOnTheScreen()
    expect(botao('Publicar')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Despublicar' })).toBeNull()
    expect(screen.getByText(RASCUNHO.imagemCapaUrl!)).toBeOnTheScreen()
  })

  it('publicada: Salvar e Despublicar', async () => {
    api.buscarNoticiaPainel.mockResolvedValue(PUBLICADA)
    await renderizar(<EditarNoticia />)
    expect(await screen.findByRole('button', { name: 'Salvar' })).toBeOnTheScreen()
    expect(botao('Despublicar')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull()
  })

  it.each<[Papel, boolean]>([
    ['DIRETOR', false],
    ['VICE_PRESIDENTE', true],
    ['PRESIDENTE', true],
  ])('%s: botão Excluir visível = %s', async (papel, visivel) => {
    comPapel(papel)
    await renderizar(<EditarNoticia />)
    await screen.findByRole('button', { name: 'Publicar' })
    expect(!!screen.queryByRole('button', { name: 'Excluir' })).toBe(visivel)
  })

  it('salvar rascunho envia só os campos alterados', async () => {
    api.atualizarNoticia.mockResolvedValue(RASCUNHO)
    await renderizar(<EditarNoticia />)
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Seletiva de vôlei')
    await fireEvent.press(botao('Salvar rascunho'))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Rascunho salvo'))
    expect(api.atualizarNoticia).toHaveBeenCalledWith(ID, { titulo: 'Seletiva de vôlei' })
  })

  it('remover uma tag envia o conjunto novo', async () => {
    api.buscarNoticiaPainel.mockResolvedValue({
      ...RASCUNHO,
      tags: [
        { id: 't1', nome: 'Futsal' },
        { id: 't2', nome: 'Seletiva' },
      ],
    })
    api.atualizarNoticia.mockResolvedValue(RASCUNHO)
    await renderizar(<EditarNoticia />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Remover tag Futsal' }))
    await fireEvent.press(botao('Salvar rascunho'))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Rascunho salvo'))
    expect(api.atualizarNoticia).toHaveBeenCalledWith(ID, { tags: ['Seletiva'] })
  })

  it('publicar rascunho alterado salva antes e depois publica', async () => {
    api.atualizarNoticia.mockResolvedValue(RASCUNHO)
    api.publicarNoticia.mockResolvedValue(PUBLICADA)
    await renderizar(<EditarNoticia />)
    await fireEvent.changeText(await screen.findByLabelText('Conteúdo'), 'Novo texto')
    await fireEvent.press(botao('Publicar'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Publicar')

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Notícia publicada'))
    expect(api.atualizarNoticia).toHaveBeenCalledWith(ID, { conteudo: 'Novo texto' })
    expect(api.publicarNoticia).toHaveBeenCalledWith(ID)
    expect(api.atualizarNoticia.mock.invocationCallOrder[0]).toBeLessThan(
      api.publicarNoticia.mock.invocationCallOrder[0]!,
    )
  })

  it('publicar rascunho sem alterações não envia PATCH', async () => {
    api.publicarNoticia.mockResolvedValue(PUBLICADA)
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Publicar')

    await waitFor(() => expect(api.publicarNoticia).toHaveBeenCalledWith(ID))
    expect(api.atualizarNoticia).not.toHaveBeenCalled()
  })

  it('422 CAPA_OBRIGATORIA ao publicar aparece junto à capa', async () => {
    const mensagem = 'Escolha a imagem de capa para publicar.'
    api.publicarNoticia.mockRejectedValue(
      new ApiErro({
        status: 422,
        code: 'CAPA_OBRIGATORIA',
        message: mensagem,
        details: [{ field: 'imagemCapaKey', message: mensagem }],
      }),
    )
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Publicar')

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('422 CONTEUDO_OBRIGATORIO ao publicar aparece no campo Conteúdo', async () => {
    const mensagem = 'Escreva o conteúdo para publicar.'
    api.publicarNoticia.mockRejectedValue(
      new ApiErro({
        status: 422,
        code: 'CONTEUDO_OBRIGATORIO',
        message: mensagem,
        details: [{ field: 'conteudo', message: mensagem }],
      }),
    )
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Publicar')

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(screen.getByLabelText('Conteúdo')).toHaveProp('accessibilityHint', mensagem)
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('422 sem details ainda aparece no campo pelo code', async () => {
    const mensagem = 'Escreva o conteúdo para publicar.'
    api.publicarNoticia.mockRejectedValue(
      new ApiErro({ status: 422, code: 'CONTEUDO_OBRIGATORIO', message: mensagem }),
    )
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Publicar')

    await waitFor(() =>
      expect(screen.getByLabelText('Conteúdo')).toHaveProp('accessibilityHint', mensagem),
    )
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('publicação que falha após salvar não deixa alterações pendentes', async () => {
    api.atualizarNoticia.mockResolvedValue({ ...RASCUNHO, conteudo: 'Novo texto' })
    api.publicarNoticia.mockRejectedValue(
      new ApiErro({ status: 422, code: 'CAPA_OBRIGATORIA', message: 'Sem capa.' }),
    )
    await renderizar(<EditarNoticia />)
    await fireEvent.changeText(await screen.findByLabelText('Conteúdo'), 'Novo texto')
    await fireEvent.press(botao('Publicar'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    await confirmarAlerta('Publicar')

    expect(await screen.findByText('Sem capa.')).toBeOnTheScreen()
    expect(api.atualizarNoticia).toHaveBeenCalledTimes(1)
    expect(botao('Salvar rascunho')).toBeDisabled()
    expect(screen.getByLabelText('Conteúdo')).toHaveDisplayValue('Novo texto')
  })

  it('publicada sem capa não salva', async () => {
    api.buscarNoticiaPainel.mockResolvedValue(PUBLICADA)
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Remover capa' }))
    await fireEvent.press(botao('Salvar'))

    expect(await screen.findByText('Escolha a imagem de capa para publicar.')).toBeOnTheScreen()
    expect(api.atualizarNoticia).not.toHaveBeenCalled()
  })

  it('publicada: troca a capa e salva com a chave nova', async () => {
    api.buscarNoticiaPainel.mockResolvedValue(PUBLICADA)
    api.atualizarNoticia.mockResolvedValue(PUBLICADA)
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Concluir envio' }))
    await fireEvent.press(botao('Salvar'))

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Notícia salva'))
    expect(api.atualizarNoticia).toHaveBeenCalledWith(ID, { imagemCapaKey: CHAVE_NOVA })
  })

  it('despublica com confirmação', async () => {
    api.buscarNoticiaPainel.mockResolvedValue(PUBLICADA)
    api.despublicarNoticia.mockResolvedValue(RASCUNHO)
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Despublicar' }))

    expect(ultimoAlerta()).toMatchObject({
      titulo: 'Despublicar notícia?',
      mensagem: 'A notícia deixará de ser exibida.',
    })
    expect(api.despublicarNoticia).not.toHaveBeenCalled()
    await confirmarAlerta('Despublicar')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Notícia despublicada'))
    expect(api.despublicarNoticia).toHaveBeenCalledWith(ID)
  })

  it('exclui com confirmação', async () => {
    comPapel('PRESIDENTE')
    api.excluirNoticia.mockResolvedValue()
    await renderizar(<EditarNoticia />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir' }))

    expect(ultimoAlerta()).toMatchObject({
      titulo: 'Excluir Seletiva de futsal?',
      mensagem: 'Esta ação não pode ser desfeita.',
    })
    expect(api.excluirNoticia).not.toHaveBeenCalled()
    await confirmarAlerta('Excluir')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Notícia excluída'))
    expect(api.excluirNoticia).toHaveBeenCalledWith(ID)
    expect(api.buscarNoticiaPainel).toHaveBeenCalledTimes(1)
  })

  it('offline: todas as ações desabilitadas e nenhuma requisição', async () => {
    comPapel('PRESIDENTE')
    api.buscarNoticiaPainel.mockResolvedValue(PUBLICADA)
    await renderizar(<EditarNoticia />)
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Seletiva de vôlei')
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
    for (const nome of ['Salvar', 'Despublicar', 'Excluir']) {
      expect(botao(nome)).toBeDisabled()
      await fireEvent.press(botao(nome))
    }
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(api.atualizarNoticia).not.toHaveBeenCalled()
    expect(api.despublicarNoticia).not.toHaveBeenCalled()
    expect(api.excluirNoticia).not.toHaveBeenCalled()
  })

  it('pede confirmação ao sair com alterações não salvas', async () => {
    const navegacao = useNavigation()
    await renderizar(<EditarNoticia />)
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Seletiva de vôlei')

    const [evento, aoSair] = jest.mocked(navegacao.addListener).mock.lastCall as unknown as [
      string,
      (e: { preventDefault: () => void; data: { action: object } }) => void,
    ]
    expect(evento).toBe('beforeRemove')
    const preventDefault = jest.fn()
    const action = { type: 'GO_BACK' }
    await act(() => aoSair({ preventDefault, data: { action } }))

    expect(preventDefault).toHaveBeenCalled()
    expect(ultimoAlerta().titulo).toBe('Descartar alterações?')
    await confirmarAlerta('Descartar')
    expect(navegacao.dispatch).toHaveBeenCalledWith(action)
  })
})

describe('Prévia', () => {
  const noticiaDaPrevia = () => jest.mocked(NoticiaDetalhe).mock.lastCall?.[0].noticia

  it('mostra o rascunho editado, sem salvar, com o NoticiaDetalhe da leitura pública (#78)', async () => {
    await renderizar(<EditarNoticia />)
    await fireEvent.changeText(await screen.findByLabelText('Conteúdo'), 'Texto **novo**')
    await fireEvent.press(botao('Prévia'))

    expect(noticiaDaPrevia()).toEqual({
      titulo: RASCUNHO.titulo,
      conteudo: 'Texto **novo**',
      imagemCapaUrl: RASCUNHO.imagemCapaUrl,
      publicadaEm: null,
      tags: [],
    })
    expect(api.atualizarNoticia).not.toHaveBeenCalled()

    await fireEvent.press(botao('Fechar prévia'))
    expect(screen.queryByRole('button', { name: 'Fechar prévia' })).toBeNull()
  })

  it('nova notícia: prévia com a capa recém-enviada', async () => {
    await renderizar(<NovaNoticia />)
    await preencher('Seletiva de futsal', 'Inscrições abertas')
    await fireEvent.press(botao('Concluir envio'))
    await fireEvent.press(botao('Prévia'))

    expect(noticiaDaPrevia()).toEqual({
      titulo: 'Seletiva de futsal',
      conteudo: 'Inscrições abertas',
      imagemCapaUrl: URI_LOCAL,
      publicadaEm: null,
      tags: [],
    })
  })
})

describe('aplicarMarcacao', () => {
  it.each<[string, Selecao, Marcacao, string, number]>([
    ['abc', { start: 0, end: 3 }, 'italico', '_abc_', 5],
    ['Veja ', { start: 5, end: 5 }, 'link', 'Veja [texto](https://)', 22],
    ['um\ndois', { start: 5, end: 5 }, 'lista', 'um\n- dois', 7],
  ])('%j %j %s → %j', (texto, selecao, marcacao, esperado, cursor) => {
    expect(aplicarMarcacao(texto, selecao, marcacao)).toEqual({ texto: esperado, cursor })
  })
})

describe('Lista de notícias do Painel', () => {
  it('mostra status, data e autor de cada notícia', async () => {
    api.listarNoticiasPainel.mockResolvedValue(pagina([PUBLICADA, { ...RASCUNHO, id: 'r2' }]))
    await renderizar(<NoticiasPainel />)

    expect(await screen.findByText('PUBLICADA')).toBeOnTheScreen()
    expect(screen.getByText('RASCUNHO')).toBeOnTheScreen()
    expect(screen.getByText('Publicada em 30/09/2026 12:00')).toBeOnTheScreen()
    expect(screen.getByText('Editada em 30/09/2026 10:30')).toBeOnTheScreen()
    expect(screen.getAllByText('Por Maria Diretora')).toHaveLength(2)
  })

  it('filtra por status e busca por título', async () => {
    await renderizar(<NoticiasPainel />)
    await screen.findByText('PUBLICADA')
    await fireEvent.press(screen.getByRole('radio', { name: 'Rascunhos' }))
    await fireEvent.changeText(screen.getByLabelText('Buscar por título'), ' seletiva ')

    await waitFor(() =>
      expect(api.listarNoticiasPainel).toHaveBeenLastCalledWith(
        { status: 'RASCUNHO', q: 'seletiva' },
        1,
        expect.anything(),
      ),
    )
  })

  it('abre a notícia ao tocar', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router')
    await renderizar(<NoticiasPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: /Seletiva de futsal/ }))
    expect(router.push).toHaveBeenCalledWith(`/painel/noticias/${ID}`)
  })

  it('vazio sem filtro oferece criar', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router')
    api.listarNoticiasPainel.mockResolvedValue(pagina([]))
    await renderizar(<NoticiasPainel />)

    expect(await screen.findByText('Nenhuma notícia cadastrada')).toBeOnTheScreen()
    const [, novaDoVazio] = screen.getAllByRole('button', { name: 'Nova notícia' })
    await fireEvent.press(novaDoVazio!)
    expect(router.push).toHaveBeenCalledWith('/painel/noticias/nova')
  })

  it('vazio com filtro oferece limpar os filtros', async () => {
    api.listarNoticiasPainel.mockResolvedValue(pagina([]))
    await renderizar(<NoticiasPainel />)
    await fireEvent.press(screen.getByRole('radio', { name: 'Publicadas' }))

    expect(await screen.findByText('Nenhuma notícia encontrada')).toBeOnTheScreen()
    await fireEvent.press(botao('Limpar filtros'))
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeSelected()
    expect(await screen.findByText('Nenhuma notícia cadastrada')).toBeOnTheScreen()
  })
})
