import type { AtleticaAdversaria, Modalidade, Papel, TimeDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import AtleticasAdversarias from '../app/(app)/(abas)/painel/times/adversarias'
import EditarTime from '../app/(app)/(abas)/painel/times/[id]/editar'
import TimesPainel from '../app/(app)/(abas)/painel/times/index'
import { toast } from '@/components/ui/toast'
import * as apiModalidades from '@/features/modalidades/api'
import { FormAtleticaAdversaria, FormTime } from '@/features/times'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/modalidades/api')
jest.mock('@/features/times/api')
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' }),
}))

const api = jest.mocked(apiTimes)

const FUTSAL: Modalidade = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Futsal',
  icone: 'soccer',
  ativa: true,
}
const VOLEI: Modalidade = {
  id: '7a2d3b8f-3a6c-4d4a-8b1f-4a4c2c9e3d22',
  nome: 'Vôlei',
  icone: 'volleyball',
  ativa: true,
}

const PROPRIO: TimeDto = {
  id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  nome: 'Futsal Masculino',
  ativo: true,
  modalidade: { id: FUTSAL.id, nome: FUTSAL.nome, icone: FUTSAL.icone },
  atletica: {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    nome: 'Lorde',
    sigla: 'LRD',
    propria: true,
  },
  capitao: { id: 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f', nome: 'Ana Souza' },
  totalMembros: 14,
}

const FENIX: AtleticaAdversaria = {
  id: 'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b',
  nome: 'Atlética Fênix',
  sigla: 'FNX',
  curso: null,
  totalTimes: 0,
}

const ADVERSARIO: TimeDto = {
  ...PROPRIO,
  id: 'd4c3b2a1-6f5e-4b7a-9c8d-5d4c3b2a1f0e',
  nome: 'Fênix Futsal',
  atletica: { id: FENIX.id, nome: FENIX.nome, sigla: FENIX.sigla, propria: false },
  capitao: null,
  totalMembros: 0,
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

async function confirmarAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  jest.mocked(apiModalidades.buscarModalidades).mockResolvedValue([FUTSAL, VOLEI])
  api.listarTimes.mockResolvedValue(pagina([PROPRIO]))
  api.listarAtleticasAdversarias.mockResolvedValue(pagina([]))
})

afterEach(() => cliente.clear())

describe('FormTime', () => {
  it('cadastra time próprio com nome e modalidade', async () => {
    api.criarTime.mockResolvedValue(PROPRIO)
    const aoSalvar = jest.fn()
    await renderizar(<FormTime aoSalvar={aoSalvar} />)

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Futsal Masculino')
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(api.criarTime).toHaveBeenCalledWith({
      nome: 'Futsal Masculino',
      modalidadeId: FUTSAL.id,
      atleticaAdversariaId: null,
    })
    expect(toast.sucesso).toHaveBeenCalledWith('Time salvo')
  })

  it('cadastro rápido de adversária seleciona a recém-criada sem perder os dados', async () => {
    api.criarAtleticaAdversaria.mockResolvedValue(FENIX)
    api.criarTime.mockResolvedValue(ADVERSARIO)
    await renderizar(<FormTime aoSalvar={jest.fn()} />)

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Fênix Futsal')
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Adversária' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar nova atlética' }))

    const [, nomeDaAtletica] = screen.getAllByLabelText('Nome')
    await fireEvent.changeText(nomeDaAtletica!, 'Atlética Fênix')
    await fireEvent.changeText(screen.getByLabelText('Sigla (opcional)'), 'fnx')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar atlética' }))

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Atlética Fênix (FNX)' })).toBeSelected(),
    )
    expect(api.criarAtleticaAdversaria).toHaveBeenCalledWith({
      nome: 'Atlética Fênix',
      sigla: 'FNX',
      curso: null,
    })
    expect(screen.queryByLabelText('Sigla (opcional)')).toBeNull()
    expect(screen.getByLabelText('Nome')).toHaveDisplayValue('Fênix Futsal')
    expect(screen.getByRole('radio', { name: 'Futsal' })).toBeSelected()

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.criarTime).toHaveBeenCalledWith({
        nome: 'Fênix Futsal',
        modalidadeId: FUTSAL.id,
        atleticaAdversariaId: FENIX.id,
      }),
    )
  })

  it('adversária sem atlética escolhida mostra erro sem chamar a API', async () => {
    await renderizar(<FormTime aoSalvar={jest.fn()} />)
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Fênix Futsal')
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Adversária' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Escolha a atlética adversária.')).toBeOnTheScreen()
    expect(api.criarTime).not.toHaveBeenCalled()
  })

  it('na edição o seletor de atlética fica desabilitado', async () => {
    api.buscarTime.mockResolvedValue({ ...ADVERSARIO, minhaSituacao: null })
    await renderizar(<EditarTime />)

    const adversaria = await screen.findByRole('radio', { name: 'Adversária' })
    expect(adversaria).toBeDisabled()
    expect(adversaria).toBeSelected()
    expect(screen.getByText('Atlética Fênix (FNX)')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Buscar atlética adversária')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cadastrar nova atlética' })).toBeNull()
  })

  it('409 TIME_DUPLICADO aparece abaixo do nome', async () => {
    const mensagem = 'Já existe um time com este nome nesta modalidade.'
    api.atualizarTime.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'TIME_DUPLICADO',
        message: mensagem,
        details: [{ field: 'nome', message: mensagem }],
      }),
    )
    const aoSalvar = jest.fn()
    await renderizar(<FormTime time={PROPRIO} aoSalvar={aoSalvar} />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(api.atualizarTime).toHaveBeenCalledWith(PROPRIO.id, {
      nome: PROPRIO.nome,
      modalidadeId: VOLEI.id,
    })
    expect(toast.erro).not.toHaveBeenCalled()
    expect(aoSalvar).not.toHaveBeenCalled()
  })

  it('409 TIME_COM_EVENTOS aparece abaixo do seletor de modalidade', async () => {
    const mensagem = 'Este time já tem eventos; a modalidade não pode ser trocada.'
    api.atualizarTime.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'TIME_COM_EVENTOS',
        message: mensagem,
        details: [{ field: 'modalidadeId', message: mensagem }],
      }),
    )
    await renderizar(<FormTime time={PROPRIO} aoSalvar={jest.fn()} />)
    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'VALIDATION_ERROR', 'nome', 'Nome inválido.'],
    [422, 'MODALIDADE_INATIVA', 'modalidadeId', 'Esta modalidade está inativa.'],
  ])('%i %s aparece no campo %s', async (status, code, field, mensagem) => {
    api.criarTime.mockRejectedValue(
      new ApiErro({ status, code, message: mensagem, details: [{ field, message: mensagem }] }),
    )
    const aoSalvar = jest.fn()
    await renderizar(<FormTime aoSalvar={aoSalvar} />)
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Futsal Masculino')
    await fireEvent.press(await screen.findByRole('radio', { name: 'Futsal' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
    expect(aoSalvar).not.toHaveBeenCalled()
  })

  it('na edição, modalidade inativa do time não é oferecida, mas é mantida', async () => {
    const handebol = {
      id: '8b3e4c9a-4b7d-4e5b-9c2a-5b5d3d0f4e33',
      nome: 'Handebol',
      icone: 'handball',
    }
    api.atualizarTime.mockResolvedValue({ ...PROPRIO, modalidade: handebol })
    await renderizar(<FormTime time={{ ...PROPRIO, modalidade: handebol }} aoSalvar={jest.fn()} />)

    expect(await screen.findByText(/Handebol está inativa/)).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Handebol' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.atualizarTime).toHaveBeenCalledWith(PROPRIO.id, {
        nome: PROPRIO.nome,
        modalidadeId: handebol.id,
      }),
    )
  })

  it('offline: Salvar desabilitado e faixa offline', async () => {
    onlineManager.setOnline(false)
    await renderizar(<FormTime aoSalvar={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText('Modo offline')).toBeOnTheScreen()
  })

  it('offline na edição: Salvar desabilitado e faixa offline', async () => {
    api.buscarTime.mockResolvedValue({ ...PROPRIO, minhaSituacao: null })
    await renderizar(<EditarTime />)
    await screen.findByRole('radio', { name: 'Futsal' })
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
  })
})

describe('FormAtleticaAdversaria', () => {
  it('409 ATLETICA_DUPLICADA aparece abaixo do nome', async () => {
    const mensagem = 'Já existe uma atlética adversária com este nome.'
    api.criarAtleticaAdversaria.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'ATLETICA_DUPLICADA',
        message: mensagem,
        details: [{ field: 'nome', message: mensagem }],
      }),
    )
    const aoSalvar = jest.fn()
    await renderizar(<FormAtleticaAdversaria aoSalvar={aoSalvar} aoCancelar={jest.fn()} />)
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Atlética Fênix')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar atlética' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(aoSalvar).not.toHaveBeenCalled()
  })
})

describe('Lista de times do Painel', () => {
  it('segmento Adversários pede o escopo à API e mostra a sigla', async () => {
    comPapel('DIRETOR')
    await renderizar(<TimesPainel />)
    await screen.findByText('Futsal Masculino')
    expect(screen.getByText('14 membros · Capitão: Ana Souza')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Elenco de Futsal Masculino' })).toBeOnTheScreen()

    api.listarTimes.mockResolvedValue(pagina([ADVERSARIO]))
    await fireEvent.press(screen.getByRole('radio', { name: 'Adversários' }))

    expect(await screen.findByText('Fênix Futsal')).toBeOnTheScreen()
    expect(screen.getByText('FNX')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Elenco de Fênix Futsal' })).toBeNull()
    expect(api.listarTimes).toHaveBeenLastCalledWith(
      expect.objectContaining({ escopo: 'ADVERSARIOS' }),
      1,
      expect.anything(),
    )
  })

  it.each([
    ['PROPRIOS', 'Nenhum time cadastrado'],
    ['ADVERSARIOS', 'Nenhum adversário cadastrado'],
  ])('vazio em %s mostra "%s"', async (escopo, mensagem) => {
    comPapel('DIRETOR')
    api.listarTimes.mockResolvedValue(pagina([]))
    await renderizar(<TimesPainel />)
    if (escopo === 'ADVERSARIOS') {
      await fireEvent.press(screen.getByRole('radio', { name: 'Adversários' }))
    }
    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
  })

  it('Mostrar inativos pede os inativos à API', async () => {
    comPapel('DIRETOR')
    await renderizar(<TimesPainel />)
    await screen.findByText('Futsal Masculino')
    await fireEvent(screen.getByLabelText('Mostrar inativos'), 'valueChange', true)
    await waitFor(() =>
      expect(api.listarTimes).toHaveBeenLastCalledWith(
        expect.objectContaining({ incluirInativos: true }),
        1,
        expect.anything(),
      ),
    )
  })

  it.each<[Papel, boolean]>([
    ['DIRETOR', false],
    ['VICE_PRESIDENTE', true],
    ['PRESIDENTE', true],
  ])('%s: botão excluir visível = %s', async (papel, visivel) => {
    comPapel(papel)
    await renderizar(<TimesPainel />)
    await screen.findByText('Futsal Masculino')
    expect(!!screen.queryByRole('button', { name: 'Excluir Futsal Masculino' })).toBe(visivel)
  })

  it('pede confirmação antes de excluir', async () => {
    comPapel('PRESIDENTE')
    api.excluirTime.mockResolvedValue()
    await renderizar(<TimesPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir Futsal Masculino' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Excluir Futsal Masculino?',
      'Esta ação não pode ser desfeita.',
      expect.any(Array),
    )
    expect(api.excluirTime).not.toHaveBeenCalled()
    await confirmarAlerta('Excluir')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Time excluído'))
    expect(api.excluirTime).toHaveBeenCalledWith(PROPRIO.id)
  })

  it('409 TIME_COM_DEPENDENCIAS oferece Desativar, que envia PATCH { ativo: false }', async () => {
    comPapel('PRESIDENTE')
    const mensagem = 'Este time tem eventos, membros ou solicitações. Desative-o em vez de excluir.'
    api.excluirTime.mockRejectedValue(
      new ApiErro({ status: 409, code: 'TIME_COM_DEPENDENCIAS', message: mensagem }),
    )
    api.atualizarTime.mockResolvedValue({ ...PROPRIO, ativo: false })
    await renderizar(<TimesPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir Futsal Masculino' }))
    await confirmarAlerta('Excluir')

    await waitFor(() => expect(toast.erro).toHaveBeenCalledTimes(1))
    const [texto, acao] = jest.mocked(toast.erro).mock.lastCall ?? ['']
    expect(texto).toBe(mensagem)
    expect(acao?.rotulo).toBe('Desativar')
    await act(() => acao?.aoTocar())
    await waitFor(() =>
      expect(api.atualizarTime).toHaveBeenCalledWith(PROPRIO.id, { ativo: false }),
    )
  })

  it('desativar pelo toggle pede confirmação', async () => {
    comPapel('DIRETOR')
    api.atualizarTime.mockResolvedValue({ ...PROPRIO, ativo: false })
    await renderizar(<TimesPainel />)
    await fireEvent(await screen.findByLabelText('Ativo: Futsal Masculino'), 'valueChange', false)

    expect(api.atualizarTime).not.toHaveBeenCalled()
    await confirmarAlerta('Desativar')
    await waitFor(() =>
      expect(api.atualizarTime).toHaveBeenCalledWith(PROPRIO.id, { ativo: false }),
    )
  })

  it('offline: toggle e excluir desabilitados e faixa offline', async () => {
    comPapel('PRESIDENTE')
    await renderizar(<TimesPainel />)
    await screen.findByText('Futsal Masculino')
    await act(() => onlineManager.setOnline(false))

    expect(screen.getByLabelText('Ativo: Futsal Masculino')).toHaveProp('disabled', true)
    expect(screen.getByRole('button', { name: 'Excluir Futsal Masculino' })).toBeDisabled()
    expect(screen.getByText(/Modo offline/)).toBeOnTheScreen()
  })
})

describe('Atléticas adversárias', () => {
  it('lista e edita no bottom sheet', async () => {
    api.listarAtleticasAdversarias.mockResolvedValue(pagina([{ ...FENIX, totalTimes: 2 }]))
    api.atualizarAtleticaAdversaria.mockResolvedValue({ ...FENIX, curso: 'Engenharia' })
    await renderizar(<AtleticasAdversarias />)

    expect(await screen.findByText('Atlética Fênix (FNX)')).toBeOnTheScreen()
    expect(screen.getByText('2 times')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Atlética Fênix' }))
    expect(screen.getByText('Editar atlética adversária')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Curso (opcional)'), 'Engenharia')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar atlética' }))

    await waitFor(() =>
      expect(api.atualizarAtleticaAdversaria).toHaveBeenCalledWith(FENIX.id, {
        nome: FENIX.nome,
        sigla: 'FNX',
        curso: 'Engenharia',
      }),
    )
    await waitFor(() => expect(screen.queryByText('Editar atlética adversária')).toBeNull())
  })

  it('vazio oferece cadastrar', async () => {
    await renderizar(<AtleticasAdversarias />)
    expect(await screen.findByText('Nenhuma atlética adversária cadastrada')).toBeOnTheScreen()
  })
})
