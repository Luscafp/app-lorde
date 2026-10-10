import type { EventoResumoDto, Perfil } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import {
  AlterarSenha,
  EditarPerfil,
  MENSAGEM_ERRO_ESTATISTICAS,
  MENSAGEM_PERFIL_ATUALIZADO,
  MENSAGEM_SEM_PRESENCAS,
  MENSAGEM_SEM_TIMES,
  MENSAGEM_SENHA_ALTERADA,
  TelaPerfil,
} from '@/features/perfil'
import * as apiEventos from '@/features/eventos/api'
import * as apiPerfil from '@/features/perfil/api'
import * as apiTimes from '@/features/times/api'
import { useUploadImagem } from '@/features/uploads'
import { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'
import { ESTATISTICAS_SEM_CHAMADA } from '../test-utils/estatisticas'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/perfil/api')
jest.mock('@/features/times/api')
jest.mock('@/features/uploads', () => ({ useUploadImagem: jest.fn() }))
jest.mock('@/features/eventos/api', () => ({
  ...jest.requireActual<object>('@/features/eventos/api'),
  listarEventos: jest.fn(),
}))

const api = jest.mocked(apiPerfil)
const listarEventos = jest.mocked(apiEventos.listarEventos)
const ID = '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const CHAVE_NOVA = `usuarios/${ID}/perfil/nova.jpg`

type Upload = ReturnType<typeof useUploadImagem>

function upload(parcial: Partial<Upload> = {}): Upload {
  return {
    estado: 'ocioso',
    progresso: 0,
    key: null,
    uriLocal: null,
    erro: null,
    podeTentarNovamente: false,
    selecionar: jest.fn(),
    tentarNovamente: jest.fn(),
    limpar: jest.fn(),
    ...parcial,
  }
}

function perfil(parcial: Partial<Perfil> = {}): Perfil {
  return {
    id: ID,
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    emailVerificado: false,
    papel: 'DIRETOR',
    atletica: { id: '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b', nome: 'Lorde', sigla: 'LORDE' },
    times: [
      {
        id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f',
        nome: 'Futsal Masculino',
        modalidade: { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal', icone: 'futsal' },
        capitao: true,
        ativo: true,
        entradaEm: '2026-08-02T13:00:00.000Z',
      },
      {
        id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
        nome: 'Vôlei Misto',
        modalidade: { id: '7a2d3b8f-3a6c-4d4a-8b1f-4a4c2c9e3d22', nome: 'Vôlei', icone: 'volei' },
        capitao: false,
        ativo: true,
        entradaEm: '2026-08-03T13:00:00.000Z',
      },
    ],
    termosAceitos: null,
    criadoEm: '2026-08-01T12:00:00.000Z',
    ...parcial,
  }
}

let cliente: QueryClient

function renderizar(elemento: React.ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

const navegacao = () => ({
  aoAbrirConfiguracoes: jest.fn(),
  aoAbrirTime: jest.fn(),
  aoAbrirEvento: jest.fn(),
  aoConhecerTimes: jest.fn(),
  aoVerificarEmail: jest.fn(),
})

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  jest.mocked(useUploadImagem).mockReturnValue(upload())
  listarEventos.mockResolvedValue({ items: [], page: 1, limit: 5, total: 0 })
  api.buscarEstatisticas.mockResolvedValue(ESTATISTICAS_SEM_CHAMADA)
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: ID,
      nome: 'Ana',
      email: 'ana@exemplo.com',
      fotoUrl: null,
      papel: 'ATLETA',
      atleticaId: 'a1',
    },
  })
})

afterEach(() => {
  cliente.clear()
})

describe('Tela Perfil', () => {
  it('carregando: esqueleto', async () => {
    api.buscarPerfil.mockReturnValue(new Promise(() => undefined))
    await renderizar(<TelaPerfil {...navegacao()} />)
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
  })

  it('nome, e-mail, cargo e times com selo de capitão (critério 1)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    const nav = navegacao()
    await renderizar(<TelaPerfil {...nav} />)

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen()
    expect(screen.getByText('ana@exemplo.com')).toBeOnTheScreen()
    expect(screen.getByText('Diretor(a)')).toBeOnTheScreen()
    expect(screen.getByLabelText('Futsal Masculino, Futsal, capitão')).toBeOnTheScreen()
    expect(screen.getByLabelText('Vôlei Misto, Vôlei')).toBeOnTheScreen()
    expect(screen.getAllByText('Capitão')).toHaveLength(1)

    await fireEvent.press(screen.getByLabelText('Vôlei Misto, Vôlei'))
    expect(nav.aoAbrirTime).toHaveBeenCalledWith('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')
    await fireEvent.press(screen.getByRole('button', { name: 'Configurações' }))
    expect(nav.aoAbrirConfiguracoes).toHaveBeenCalled()
  })

  it('e-mail não verificado: selo e botão "Verificar e-mail" (#31)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil({ emailVerificado: false }))
    const nav = navegacao()
    await renderizar(<TelaPerfil {...nav} />)

    expect(await screen.findByText('E-mail não verificado')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar e-mail' }))
    expect(nav.aoVerificarEmail).toHaveBeenCalled()
  })

  it('e-mail verificado: selo sem botão (#31)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil({ emailVerificado: true }))
    await renderizar(<TelaPerfil {...navegacao()} />)

    expect(await screen.findByText('E-mail verificado')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Verificar e-mail' })).toBeNull()
  })

  it('time inativo: selo "Inativo" e "Sair do time" na linha, sem abrir a tela (#34)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    jest.mocked(apiTimes.sairDoTime).mockResolvedValue({
      timeId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      saidaEm: '2026-11-02T18:30:00.000Z',
      capitaniaRemovida: false,
      participacoesRemovidas: 0,
    })
    const [ativo, inativo] = perfil().times
    api.buscarPerfil.mockResolvedValue(perfil({ times: [ativo!, { ...inativo!, ativo: false }] }))
    await renderizar(<TelaPerfil {...navegacao()} />)

    expect(await screen.findByText('Inativo')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Vôlei Misto, Vôlei')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Sair do time' }))
    const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
    await act(() => botoes?.find((botao) => botao.text === 'Sair')?.onPress?.())

    expect(apiTimes.sairDoTime).toHaveBeenCalledWith('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Você saiu do time'))
  })

  it('sem foto: iniciais', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    await renderizar(<TelaPerfil {...navegacao()} />)
    expect(await screen.findByText('AS')).toBeOnTheScreen()
  })

  it('sem times: convite "Conhecer os times" (critério 2)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil({ times: [] }))
    const nav = navegacao()
    await renderizar(<TelaPerfil {...nav} />)

    expect(await screen.findByText(MENSAGEM_SEM_TIMES)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Conhecer os times' }))
    expect(nav.aoConhecerTimes).toHaveBeenCalled()
  })

  it('erro: "Tentar novamente" refaz a consulta', async () => {
    api.buscarPerfil.mockRejectedValueOnce(
      new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'Falha' }),
    )
    await renderizar(<TelaPerfil {...navegacao()} />)
    api.buscarPerfil.mockResolvedValue(perfil())

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen()
  })

  it('offline com cache: dados e faixa offline (critério 16)', async () => {
    cliente.setQueryData(chaves.me(), perfil())
    onlineManager.setOnline(false)
    await renderizar(<TelaPerfil {...navegacao()} />)
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen()
    expect(screen.getByText(/Modo offline · dados de/)).toBeOnTheScreen()
  })

  it('o papel do GET /me atualiza a sessão sem novo login (critério 4)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil({ papel: 'PRESIDENTE' }))
    await renderizar(<TelaPerfil {...navegacao()} />)
    await waitFor(() => expect(useSessao.getState().usuario?.papel).toBe('PRESIDENTE'))
    expect(useSessao.getState().usuario?.nome).toBe('Ana Souza')
  })

  it('403 FORBIDDEN em qualquer rota invalida o ["me"]', async () => {
    cliente.setQueryData(chaves.me(), perfil())
    await act(() =>
      cliente
        .fetchQuery({
          queryKey: ['outra'],
          queryFn: () =>
            Promise.reject(
              new ApiErro({ status: 403, code: 'FORBIDDEN', message: 'Sem permissão' }),
            ),
        })
        .catch(() => undefined),
    )
    expect(cliente.getQueryState(chaves.me())?.isInvalidated).toBe(true)
  })
})

function eventoConfirmado(id: string, inicio: string, local: string): EventoResumoDto {
  return {
    id,
    tipo: 'TREINO',
    status: 'AGENDADO',
    inicio,
    local,
    serieId: null,
    time: { id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f', nome: 'Futsal Masculino' },
    modalidade: { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal', icone: 'futsal' },
    timeAdversario: null,
    placarTime: null,
    placarAdversario: null,
    resultado: null,
    souMembro: true,
    minhaParticipacao: { confirmado: true, respondidoEm: '2026-10-01T12:00:00.000Z' },
  }
}

describe('Estatísticas (#85)', () => {
  const secao = () => within(screen.getByTestId('secao-estatisticas'))

  it('jogos, treinos e taxa de presença', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    api.buscarEstatisticas.mockResolvedValue({
      jogosParticipados: 2,
      treinosPresentes: 5,
      eventosComChamada: 10,
      taxaPresenca: 70,
    })
    await renderizar(<TelaPerfil {...navegacao()} />)

    expect(await screen.findByLabelText('Jogos participados: 2')).toBeOnTheScreen()
    expect(secao().getByLabelText('Treinos presentes: 5')).toBeOnTheScreen()
    expect(secao().getByLabelText('Taxa de presença: 70%')).toBeOnTheScreen()
    expect(secao().queryByText(MENSAGEM_SEM_PRESENCAS)).toBeNull()
  })

  it('sem chamada: taxa "—" com a legenda (critério 12)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    await renderizar(<TelaPerfil {...navegacao()} />)

    expect(await screen.findByLabelText('Taxa de presença: —')).toBeOnTheScreen()
    expect(secao().getByLabelText('Jogos participados: 0')).toBeOnTheScreen()
    expect(secao().getByText(MENSAGEM_SEM_PRESENCAS)).toBeOnTheScreen()
  })

  it('erro: estado próprio da seção, sem afetar o restante do Perfil', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    api.buscarEstatisticas.mockRejectedValue(new Error('falhou'))
    await renderizar(<TelaPerfil {...navegacao()} />)

    expect(await screen.findByText(MENSAGEM_ERRO_ESTATISTICAS)).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen()
    expect(cliente.getQueryState(chaves.me.estatisticas())?.status).toBe('error')
  })
})

describe('Meus próximos eventos (#24)', () => {
  const PRIMEIRO = '1a1a1a1a-0000-4000-8000-000000000001'
  const SEGUNDO = '2b2b2b2b-0000-4000-8000-000000000002'

  it('lista os confirmados na ordem da API e abre o evento (critério 16)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    listarEventos.mockResolvedValue({
      items: [
        eventoConfirmado(PRIMEIRO, '2026-10-10T22:00:00.000Z', 'Quadra A'),
        eventoConfirmado(SEGUNDO, '2026-10-12T22:00:00.000Z', 'Quadra B'),
      ],
      page: 1,
      limit: 5,
      total: 2,
    })
    const nav = navegacao()
    await renderizar(<TelaPerfil {...nav} />)

    expect(await screen.findByText(/Quadra A/)).toBeOnTheScreen()
    expect(listarEventos).toHaveBeenCalledWith(
      { periodo: 'PROXIMOS', confirmadoPorMim: true },
      { page: 1, limit: 5 },
      expect.anything(),
    )
    const consultas = cliente.getQueryCache().findAll({ queryKey: chaves.eventos.todos() })
    expect(consultas.map(({ queryKey }) => queryKey)).toEqual([
      chaves.eventos.lista({ periodo: 'PROXIMOS', confirmadoPorMim: true, limit: 5 }),
    ])
    const [primeiro, segundo] = screen.getAllByText(/Quadra [AB]/)
    expect(primeiro).toHaveTextContent(/Quadra A/)
    expect(segundo).toHaveTextContent(/Quadra B/)

    await fireEvent.press(screen.getAllByRole('button', { name: /Quadra B/ })[0]!)
    expect(nav.aoAbrirEvento).toHaveBeenCalledWith(SEGUNDO)
  })

  it('vazio: mensagem própria (critério 17)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    await renderizar(<TelaPerfil {...navegacao()} />)
    expect(
      await screen.findByText('Você não confirmou presença em nenhum evento próximo.'),
    ).toBeOnTheScreen()
  })

  it('erro só na seção: "Tentar novamente" e o restante do Perfil visível (critério 17)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    listarEventos.mockRejectedValueOnce(
      new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }),
    )
    await renderizar(<TelaPerfil {...navegacao()} />)

    expect(
      await screen.findByText('Não foi possível carregar seus próximos eventos'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen()
    expect(screen.getByLabelText('Futsal Masculino, Futsal, capitão')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(
      await screen.findByText('Você não confirmou presença em nenhum evento próximo.'),
    ).toBeOnTheScreen()
  })
  it('carregando só na seção: esqueleto e o restante do Perfil visível (critério 17)', async () => {
    api.buscarPerfil.mockResolvedValue(perfil())
    listarEventos.mockReturnValue(new Promise(() => undefined))
    await renderizar(<TelaPerfil {...navegacao()} />)

    const secao = await screen.findByTestId('meus-proximos-eventos')
    expect(within(secao).getByLabelText('Carregando')).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen()
  })

  it('offline sem cache só na seção: "Sem conexão" e o restante do Perfil visível (critério 17)', async () => {
    cliente.setQueryData(chaves.me(), perfil())
    onlineManager.setOnline(false)
    await renderizar(<TelaPerfil {...navegacao()} />)

    const secao = await screen.findByTestId('meus-proximos-eventos')
    expect(
      within(secao).getByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen()
    expect(listarEventos).not.toHaveBeenCalled()
  })
})

describe('Editar perfil', () => {
  async function abrir(dados = perfil()) {
    cliente.setQueryData(chaves.me(), dados)
    const aoSalvar = jest.fn()
    await renderizar(<EditarPerfil aoSalvar={aoSalvar} />)
    return aoSalvar
  }

  it('"Salvar" desabilitado sem alterações', async () => {
    await abrir()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana Souza')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('salva o nome com trim e mostra "Perfil atualizado" (critério 5)', async () => {
    const aoSalvar = await abrir()
    api.atualizarPerfil.mockResolvedValue(perfil({ nome: 'Ana Lima' }))

    await fireEvent.changeText(screen.getByLabelText('Nome'), '  Ana Lima  ')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(api.atualizarPerfil).toHaveBeenCalledWith({ nome: 'Ana Lima' })
    expect(api.definirFoto).not.toHaveBeenCalled()
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_PERFIL_ATUALIZADO)
    expect(cliente.getQueryData<Perfil>(chaves.me())?.nome).toBe('Ana Lima')
    expect(useSessao.getState().usuario?.nome).toBe('Ana Lima')
  })

  it('nome curto: erro no campo e a API não é chamada (critério 6)', async () => {
    await abrir()
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'A')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('O nome deve ter ao menos 2 caracteres.')).toBeOnTheScreen()
    expect(api.atualizarPerfil).not.toHaveBeenCalled()
  })

  it('foto enviada: PUT /me/foto com a chave do upload (critério 7)', async () => {
    jest
      .mocked(useUploadImagem)
      .mockReturnValue(upload({ estado: 'concluido', progresso: 1, key: CHAVE_NOVA }))
    api.definirFoto.mockResolvedValue({ fotoUrl: `https://img/${CHAVE_NOVA}` })
    const aoSalvar = await abrir()

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(api.definirFoto).toHaveBeenCalledWith(CHAVE_NOVA)
    expect(api.atualizarPerfil).not.toHaveBeenCalled()
  })

  it('upload em andamento: progresso sobre o avatar e "Salvar" desabilitado', async () => {
    jest.mocked(useUploadImagem).mockReturnValue(upload({ estado: 'enviando', progresso: 0.4 }))
    await abrir()
    expect(screen.getByRole('progressbar', { name: 'Enviando imagem' })).toHaveProp(
      'accessibilityValue',
      { min: 0, max: 100, now: 40 },
    )
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana Lima')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('formato não suportado: mostra o erro e não chama a API (critério 8)', async () => {
    const mensagem = 'Formato de imagem não suportado.'
    jest.mocked(useUploadImagem).mockReturnValue(upload({ estado: 'erro', erro: mensagem }))
    await abrir()
    expect(screen.getByText(mensagem)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(api.definirFoto).not.toHaveBeenCalled()
  })

  it('remover foto: DELETE /me/foto ao salvar (critério 11)', async () => {
    const aoSalvar = await abrir(perfil({ fotoUrl: 'https://img/atual.jpg' }))
    api.removerFoto.mockResolvedValue()

    await fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(api.removerFoto).toHaveBeenCalled()
  })

  it('offline: "Salvar" desabilitado com o aviso (critério 16)', async () => {
    onlineManager.setOnline(false)
    await abrir()
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana Lima')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
  })
})

describe('Alterar senha', () => {
  async function preencher(senhaAtual: string, novaSenha: string, confirmarSenha = novaSenha) {
    await fireEvent.changeText(screen.getByLabelText('Senha atual'), senhaAtual)
    await fireEvent.changeText(screen.getByLabelText('Nova senha'), novaSenha)
    await fireEvent.changeText(screen.getByLabelText('Confirmar nova senha'), confirmarSenha)
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
  }

  it('confirmação divergente: erro no campo e a API não é chamada', async () => {
    await renderizar(<AlterarSenha aoConcluir={jest.fn()} />)
    await preencher('lorde2026', 'novaSenha9', 'novaSenha8')
    expect(await screen.findByText('As senhas não conferem.')).toBeOnTheScreen()
    expect(api.alterarSenha).not.toHaveBeenCalled()
  })

  it('sucesso: toast "Senha alterada" e volta (critério 12)', async () => {
    api.alterarSenha.mockResolvedValue()
    const aoConcluir = jest.fn()
    await renderizar(<AlterarSenha aoConcluir={aoConcluir} />)
    await preencher('lorde2026', 'novaSenha9')

    await waitFor(() => expect(aoConcluir).toHaveBeenCalled())
    expect(api.alterarSenha).toHaveBeenCalledWith({
      senhaAtual: 'lorde2026',
      novaSenha: 'novaSenha9',
    })
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_SENHA_ALTERADA)
  })

  it('SENHA_INCORRETA aparece no campo "Senha atual", sem toast (critério 13)', async () => {
    api.alterarSenha.mockRejectedValue(
      new ApiErro({
        status: 400,
        code: 'SENHA_INCORRETA',
        message: 'Senha atual incorreta.',
        details: [{ field: 'senhaAtual', message: 'Senha atual incorreta.' }],
      }),
    )
    const aoConcluir = jest.fn()
    await renderizar(<AlterarSenha aoConcluir={aoConcluir} />)
    await preencher('errada123', 'novaSenha9')

    expect(await screen.findByText('Senha atual incorreta.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Senha atual')).toHaveProp(
      'accessibilityHint',
      'Senha atual incorreta.',
    )
    expect(toast.erro).not.toHaveBeenCalled()
    expect(aoConcluir).not.toHaveBeenCalled()
  })

  it('offline: "Salvar" desabilitado com o aviso', async () => {
    onlineManager.setOnline(false)
    await renderizar(<AlterarSenha aoConcluir={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
  })
})
