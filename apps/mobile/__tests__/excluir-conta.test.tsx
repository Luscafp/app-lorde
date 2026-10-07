import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import { ExcluirConta, MENSAGEM_CONTA_EXCLUIDA } from '@/features/perfil'
import * as apiPerfil from '@/features/perfil/api'
import { ApiErro } from '@/infra/api/api-erro'
import { criarQueryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { adicionarLogoutPendente } from '@/infra/sessao/logout-pendente'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/perfil/api')
jest.mock('@/infra/sessao/logout-pendente')

const api = jest.mocked(apiPerfil)
const MENSAGEM_ULTIMO_ADMIN =
  'Você é o único Administrador. Conceda o cargo a outra pessoa antes de excluir sua conta.'

let cliente: QueryClient
let encerrarSessao: jest.Mock

function renderizar() {
  return render(
    <QueryClientProvider client={cliente}>
      <ExcluirConta />
    </QueryClientProvider>,
  )
}

const botaoExcluir = () => screen.getByRole('button', { name: 'Excluir minha conta' })

async function preencher({ senha = 'lorde2026', marcar = true } = {}) {
  if (senha) await fireEvent.changeText(screen.getByLabelText('Senha'), senha)
  if (marcar) await fireEvent.press(screen.getByRole('checkbox'))
}

/** Toca em "Excluir minha conta" e confirma no diálogo. */
async function confirmar() {
  await fireEvent.press(botaoExcluir())
  const [titulo, , botoes] = jest.mocked(Alert.alert).mock.calls.at(-1) ?? []
  expect(titulo).toBe('Excluir conta definitivamente?')
  const excluir = (botoes as AlertButton[]).find(({ text }) => text === 'Excluir')
  excluir?.onPress?.()
}

beforeEach(() => {
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  encerrarSessao = jest.fn().mockResolvedValue(undefined)
  useSessao.setState({ status: 'autenticado', encerrarSessao })
})

afterEach(() => {
  cliente.clear()
})

describe('Excluir conta (#12)', () => {
  it('lista as consequências da exclusão', async () => {
    await renderizar()
    expect(screen.getByText('Ao excluir sua conta')).toBeOnTheScreen()
    expect(screen.getByText(/dados pessoais serão anonimizados/i)).toBeOnTheScreen()
    expect(screen.getByText(/sairá de todos os times/i)).toBeOnTheScreen()
    expect(screen.getByText(/solicitações pendentes serão canceladas/i)).toBeOnTheScreen()
    expect(screen.getByText(/presenças e resultados/i)).toBeOnTheScreen()
    expect(screen.getByText('• Esta ação não pode ser desfeita.')).toBeOnTheScreen()
  })

  it('botão só habilita com senha e confirmação marcada', async () => {
    await renderizar()
    expect(botaoExcluir()).toBeDisabled()
    await preencher({ marcar: false })
    expect(botaoExcluir()).toBeDisabled()
    await fireEvent.press(screen.getByRole('checkbox'))
    expect(botaoExcluir()).toBeEnabled()
    await fireEvent.changeText(screen.getByLabelText('Senha'), '')
    expect(botaoExcluir()).toBeDisabled()
  })

  it('offline: botão desabilitado com aviso e nada é enviado (critério 16)', async () => {
    onlineManager.setOnline(false)
    await renderizar()
    await preencher()
    expect(botaoExcluir()).toBeDisabled()
    expect(screen.getByText(MENSAGEM_ACAO_OFFLINE)).toBeOnTheScreen()
    expect(api.excluirConta).not.toHaveBeenCalled()
  })

  it('cancelar no diálogo não envia', async () => {
    await renderizar()
    await preencher()
    await fireEvent.press(botaoExcluir())
    expect(Alert.alert).toHaveBeenCalled()
    expect(api.excluirConta).not.toHaveBeenCalled()
  })

  it('sucesso: encerra a sessão sem logout pendente e mostra "Conta excluída"', async () => {
    api.excluirConta.mockResolvedValue()
    await renderizar()
    await preencher()
    await confirmar()

    await waitFor(() => expect(encerrarSessao).toHaveBeenCalledWith({ motivo: 'CONTA_EXCLUIDA' }))
    expect(api.excluirConta).toHaveBeenCalledWith({ senha: 'lorde2026' })
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_CONTA_EXCLUIDA)
    expect(adicionarLogoutPendente).not.toHaveBeenCalled()
  })

  it('sucesso: "Conta excluída" aparece mesmo com a tela desmontada ao encerrar a sessão', async () => {
    api.excluirConta.mockResolvedValue()
    const { unmount } = await renderizar()
    encerrarSessao.mockImplementation(async () => unmount())
    await preencher()
    await confirmar()

    await waitFor(() => expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_CONTA_EXCLUIDA))
  })

  it('SENHA_INCORRETA: erro no campo, confirmação continua marcada e a sessão fica', async () => {
    api.excluirConta.mockRejectedValue(
      new ApiErro({
        status: 400,
        code: 'SENHA_INCORRETA',
        message: 'Senha incorreta.',
        details: [{ field: 'senha', message: 'Senha incorreta.' }],
      }),
    )
    await renderizar()
    await preencher({ senha: 'errada123' })
    await confirmar()

    expect(await screen.findByText('Senha incorreta.')).toBeOnTheScreen()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(toast.erro).not.toHaveBeenCalled()
    expect(encerrarSessao).not.toHaveBeenCalled()
  })

  it('ULTIMO_ADMINISTRADOR: caixa com a mensagem da API, sem encerrar a sessão (critério 7)', async () => {
    api.excluirConta.mockRejectedValue(
      new ApiErro({ status: 409, code: 'ULTIMO_ADMINISTRADOR', message: MENSAGEM_ULTIMO_ADMIN }),
    )
    await renderizar()
    await preencher()
    await confirmar()

    expect(await screen.findByText(MENSAGEM_ULTIMO_ADMIN)).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
    expect(encerrarSessao).not.toHaveBeenCalled()
  })

  it('RATE_LIMITED: informa em quantos minutos tentar de novo', async () => {
    api.excluirConta.mockRejectedValue(
      new ApiErro({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Muitas tentativas. Tente novamente mais tarde.',
        segundosParaNovaTentativa: 14 * 60 + 5,
      }),
    )
    await renderizar()
    await preencher()
    await confirmar()

    expect(
      await screen.findByText('Muitas tentativas. Tente novamente em 15 min.'),
    ).toBeOnTheScreen()
    expect(toast.erro).not.toHaveBeenCalled()
  })
})
