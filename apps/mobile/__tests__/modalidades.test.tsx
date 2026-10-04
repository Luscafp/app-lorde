import type { Modalidade, Papel } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert, type AlertButton } from 'react-native'
import ModalidadesPainel from '../app/(app)/(abas)/painel/modalidades/index'
import { toast } from '@/components/ui/toast'
import * as apiModalidades from '@/features/modalidades/api'
import { FormModalidade, ModalidadeIcone } from '@/features/modalidades'
import { ApiErro } from '@/infra/api/cliente'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/modalidades/api')
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))

const api = jest.mocked(apiModalidades)

const FUTSAL: Modalidade = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Futsal',
  icone: 'soccer',
  ativa: true,
}

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

/** Toca no botão `texto` do último `Alert.alert`. */
async function confirmarAlerta(texto: string) {
  const botoes: AlertButton[] | undefined = jest.mocked(Alert.alert).mock.lastCall?.[2]
  await act(() => botoes?.find((botao) => botao.text === texto)?.onPress?.())
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  api.buscarModalidades.mockResolvedValue([FUTSAL])
})

afterEach(() => cliente.clear())

describe('ModalidadeIcone', () => {
  it('chave desconhecida usa o ícone genérico', async () => {
    await render(<ModalidadeIcone icone="bola" />)
    expect(screen.getByTestId('icone-trophy')).toBeOnTheScreen()
  })

  it('chave do catálogo usa o próprio ícone', async () => {
    await render(<ModalidadeIcone icone="volleyball" />)
    expect(screen.getByTestId('icone-volleyball')).toBeOnTheScreen()
  })
})

describe('FormModalidade', () => {
  it('nome vazio e ícone ausente mostram erro por campo sem chamar a API', async () => {
    await renderizar(<FormModalidade aoSalvar={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('O nome deve ter ao menos 2 caracteres.')).toBeOnTheScreen()
    expect(screen.getByText('Escolha um ícone.')).toBeOnTheScreen()
    expect(api.criarModalidade).not.toHaveBeenCalled()
  })

  it('cadastra com nome e ícone, mostra o toast e volta', async () => {
    api.criarModalidade.mockResolvedValue({ ...FUTSAL, nome: 'Handebol', icone: 'handball' })
    const aoSalvar = jest.fn()
    await renderizar(<FormModalidade aoSalvar={aoSalvar} />)

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Handebol')
    await fireEvent.press(screen.getByRole('radio', { name: 'Handebol' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    expect(api.criarModalidade).toHaveBeenCalledWith({ nome: 'Handebol', icone: 'handball' })
    expect(toast.sucesso).toHaveBeenCalledWith('Modalidade salva')
  })

  it('409 MODALIDADE_DUPLICADA aparece abaixo do nome e mantém os dados', async () => {
    const mensagem = 'Já existe uma modalidade com este nome.'
    api.atualizarModalidade.mockRejectedValue(
      new ApiErro({
        status: 409,
        code: 'MODALIDADE_DUPLICADA',
        message: mensagem,
        details: [{ field: 'nome', message: mensagem }],
      }),
    )
    const aoSalvar = jest.fn()
    await renderizar(<FormModalidade modalidade={FUTSAL} aoSalvar={aoSalvar} />)

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Vôlei')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    expect(screen.getByLabelText('Nome')).toHaveDisplayValue('Vôlei')
    expect(screen.getByRole('radio', { name: 'Futebol' })).toBeSelected()
    expect(api.atualizarModalidade).toHaveBeenCalledWith(FUTSAL.id, {
      nome: 'Vôlei',
      icone: 'soccer',
    })
    expect(toast.erro).not.toHaveBeenCalled()
    expect(aoSalvar).not.toHaveBeenCalled()
  })

  it('offline: botão Salvar desabilitado e faixa offline (critério 15)', async () => {
    onlineManager.setOnline(false)
    await renderizar(<FormModalidade aoSalvar={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText('Modo offline')).toBeOnTheScreen()
  })
})

describe('Lista de modalidades do Painel', () => {
  it.each<[Papel, boolean]>([
    ['DIRETOR', false],
    ['PRESIDENTE', true],
    ['VICE_PRESIDENTE', true],
  ])('%s: botão excluir visível = %s (critério 14)', async (papel, visivel) => {
    comPapel(papel)
    await renderizar(<ModalidadesPainel />)
    await screen.findByText('Futsal')
    expect(!!screen.queryByRole('button', { name: 'Excluir Futsal' })).toBe(visivel)
  })

  it('pede confirmação antes de excluir', async () => {
    comPapel('PRESIDENTE')
    api.excluirModalidade.mockResolvedValue()
    await renderizar(<ModalidadesPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir Futsal' }))

    expect(Alert.alert).toHaveBeenCalledWith(
      'Excluir Futsal?',
      'Esta ação não pode ser desfeita.',
      expect.any(Array),
    )
    expect(api.excluirModalidade).not.toHaveBeenCalled()
    await confirmarAlerta('Excluir')
    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith('Modalidade excluída'))
    expect(api.excluirModalidade).toHaveBeenCalledWith(FUTSAL.id)
  })

  it('409 MODALIDADE_COM_DEPENDENCIAS oferece desativar no toast', async () => {
    comPapel('PRESIDENTE')
    const mensagem = 'Esta modalidade tem times vinculados. Desative-a em vez de excluir.'
    api.excluirModalidade.mockRejectedValue(
      new ApiErro({ status: 409, code: 'MODALIDADE_COM_DEPENDENCIAS', message: mensagem }),
    )
    api.atualizarModalidade.mockResolvedValue({ ...FUTSAL, ativa: false })
    await renderizar(<ModalidadesPainel />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir Futsal' }))
    await confirmarAlerta('Excluir')

    await waitFor(() => expect(toast.erro).toHaveBeenCalledTimes(1))
    const [texto, acao] = jest.mocked(toast.erro).mock.lastCall ?? ['']
    expect(texto).toBe(mensagem)
    expect(acao?.titulo).toBe('Desativar')
    await act(() => acao?.onPress())
    await waitFor(() =>
      expect(api.atualizarModalidade).toHaveBeenCalledWith(FUTSAL.id, { ativa: false }),
    )
  })

  it('desativar pede confirmação e é otimista, com rollback em erro', async () => {
    comPapel('DIRETOR')
    let falhar: (erro: ApiErro) => void = () => undefined
    api.atualizarModalidade.mockReturnValue(new Promise((_, rejeitar) => (falhar = rejeitar)))
    await renderizar(<ModalidadesPainel />)
    const toggle = await screen.findByLabelText('Ativa: Futsal')

    await fireEvent(toggle, 'valueChange', false)
    expect(Alert.alert).toHaveBeenCalledWith(
      'Desativar Futsal?',
      'Ela deixará de aparecer na aba Times.',
      expect.any(Array),
    )
    await confirmarAlerta('Desativar')

    expect(await screen.findByText('INATIVA')).toBeOnTheScreen()
    await act(() => falhar(new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'Erro.' })))
    await waitFor(() => expect(screen.queryByText('INATIVA')).toBeNull())
    expect(toast.erro).toHaveBeenCalledWith('Erro.')
  })

  it('lista vazia oferece cadastrar', async () => {
    comPapel('DIRETOR')
    api.buscarModalidades.mockResolvedValue([])
    await renderizar(<ModalidadesPainel />)
    expect(await screen.findByText('Nenhuma modalidade cadastrada')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Nova modalidade' })).toBeOnTheScreen()
  })

  it('pede as inativas à API', async () => {
    comPapel('DIRETOR')
    await renderizar(<ModalidadesPainel />)
    await screen.findByText('Futsal')
    expect(api.buscarModalidades).toHaveBeenCalledWith({ incluirInativas: true }, expect.anything())
  })
})
