import type { Perfil } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { toast } from '@/components/ui/toast'
import * as apiPerfil from '@/features/perfil/api'
import {
  AvisoVerificacaoEmail,
  MENSAGEM_EMAIL_VERIFICADO,
  TelaVerificarEmail,
  useVerificacaoEmailStore,
} from '@/features/verificacao-email'
import { useCadastro } from '@/features/auth/use-cadastro'
import { api, ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/perfil/api')
jest.mock('@/infra/api/cliente', () => ({
  ...jest.requireActual<object>('@/infra/api/cliente'),
  api: { post: jest.fn() },
}))

const post = jest.mocked(api.post)
const buscarPerfil = jest.mocked(apiPerfil.buscarPerfil)

const PERFIL: Perfil = {
  id: '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90',
  nome: 'Ana Souza',
  email: 'ana@gmail.com',
  fotoUrl: null,
  emailVerificado: false,
  papel: 'ATLETA',
  atletica: { id: '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b', nome: 'Atlética', sigla: 'ATT' },
  times: [],
  termosAceitos: null,
  criadoEm: '2026-08-01T12:00:00.000Z',
}

let cliente: QueryClient

function renderizar(elemento: React.ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

const caixa = (posicao: number) => screen.getByLabelText(`Dígito ${posicao} de 6`)
const valores = () =>
  [1, 2, 3, 4, 5, 6].map((posicao) => (caixa(posicao).props as { value: string }).value)

async function abrirTela(perfil: Partial<Perfil> = {}) {
  buscarPerfil.mockResolvedValue({ ...PERFIL, ...perfil })
  const aoConcluir = jest.fn()
  await renderizar(<TelaVerificarEmail aoConcluir={aoConcluir} />)
  return aoConcluir
}

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  useVerificacaoEmailStore.setState({ avisoPara: null, proximoEnvioEm: null })
})

afterEach(() => {
  cliente.clear()
  jest.useRealTimers()
})

describe('Tela Verificar e-mail', () => {
  it('colar 6 dígitos e verificar → toast, volta e invalida o perfil (critério 3)', async () => {
    const aoConcluir = await abrirTela()
    const invalidar = jest.spyOn(cliente, 'invalidateQueries')
    post.mockResolvedValue({ emailVerificado: true })

    expect(await screen.findByText(/enviado para ana@gmail\.com/)).toBeOnTheScreen()
    await fireEvent.changeText(caixa(1), '482913')
    expect(valores()).toEqual(['4', '8', '2', '9', '1', '3'])
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))

    expect(post).toHaveBeenCalledWith('/auth/verificar-email', { codigo: '482913' })
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_EMAIL_VERIFICADO)
    expect(aoConcluir).toHaveBeenCalled()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chaves.me(), exact: true })
  })

  it('CODIGO_INVALIDO → "Código inválido." mantendo o código (critério 4)', async () => {
    await abrirTela()
    post.mockRejectedValue(
      new ApiErro({
        status: 400,
        code: 'CODIGO_INVALIDO',
        message: 'Código inválido ou expirado.',
      }),
    )

    await screen.findByText(/enviado para/)
    await fireEvent.changeText(caixa(1), '111111')
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))

    expect(screen.getByText('Código inválido.')).toBeOnTheScreen()
    expect(valores()).toEqual(['1', '1', '1', '1', '1', '1'])
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('CODIGO_EXPIRADO → oferece reenviar (critério 5)', async () => {
    await abrirTela()
    post.mockRejectedValue(
      new ApiErro({ status: 400, code: 'CODIGO_EXPIRADO', message: 'Código expirado.' }),
    )

    await screen.findByText(/enviado para/)
    await fireEvent.changeText(caixa(1), '111111')
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar' }))

    expect(screen.getByText('Código expirado. Reenvie um novo código.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeEnabled()
  })

  it('reenviar → contagem regressiva de 60 s até liberar de novo (critério 8)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T12:00:00.000Z') })
    await abrirTela()
    post.mockResolvedValue({
      enviadoPara: 'a***@gmail.com',
      expiraEm: '2026-10-02T12:00:00.000Z',
      proximoEnvioEm: '2026-10-01T12:01:00.000Z',
    })

    await fireEvent.press(await screen.findByRole('button', { name: 'Reenviar código' }))

    expect(post).toHaveBeenCalledWith('/auth/verificar-email/enviar')
    expect(toast.sucesso).toHaveBeenCalledWith('Enviamos um novo código.')
    expect(screen.getByRole('button', { name: 'Reenviar código em 60 s' })).toBeDisabled()
    await act(() => jest.advanceTimersByTime(60_000))
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeEnabled()
  })

  it('429 → mostra a mensagem e conta até proximoEnvioEm (critério 7)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T12:00:00.000Z') })
    await abrirTela()
    post.mockRejectedValue(
      new ApiErro({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Aguarde para pedir um novo código.',
        details: [{ field: 'proximoEnvioEm', message: '2026-10-01T12:30:00.000Z' }],
      }),
    )

    await fireEvent.press(await screen.findByRole('button', { name: 'Reenviar código' }))

    expect(screen.getByText('Aguarde para pedir um novo código.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Reenviar código em 30:00' })).toBeDisabled()
    expect(toast.erro).not.toHaveBeenCalled()
  })

  it('já verificado: sem campo nem botão de reenvio', async () => {
    await abrirTela({ emailVerificado: true })

    expect(await screen.findByText('Seu e-mail já está verificado.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Reenviar código' })).toBeNull()
  })

  it('offline: verificar bloqueado', async () => {
    await abrirTela()
    await screen.findByText(/enviado para/)
    await act(() => onlineManager.setOnline(false))
    await fireEvent.changeText(caixa(1), '482913')

    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled()
  })
})

describe('Aviso pós-cadastro na Home', () => {
  it('cadastro concluído agenda o aviso com o e-mail e a espera de reenvio', async () => {
    const { id, nome, email, fotoUrl, papel } = PERFIL
    post.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiraEm: '2026-10-01T12:15:00.000Z',
      usuario: { id, nome, email, fotoUrl, papel, atleticaId: PERFIL.atletica.id },
    })
    useSessao.setState({ iniciarSessao: jest.fn().mockResolvedValue(undefined) })
    const { result } = await renderHook(() => useCadastro(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
      ),
    })

    await act(() =>
      result.current.mutateAsync({
        nome,
        email,
        senha: 'lorde2026',
        aceiteTermos: true,
        versaoTermos: '2026-10-01',
      }),
    )

    const { avisoPara, proximoEnvioEm } = useVerificacaoEmailStore.getState()
    expect(avisoPara).toBe(email)
    expect(proximoEnvioEm).toBeGreaterThan(Date.now())
  })

  it('"Verificar e-mail" abre a verificação e o aviso some', async () => {
    useVerificacaoEmailStore.setState({ avisoPara: 'ana@gmail.com' })
    const aoVerificar = jest.fn()
    await renderizar(<AvisoVerificacaoEmail aoVerificar={aoVerificar} />)

    expect(
      screen.getByText('Enviamos um código para ana@gmail.com. Verifique seu e-mail.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar e-mail' }))

    expect(aoVerificar).toHaveBeenCalled()
    expect(screen.queryByText(/Enviamos um código/)).toBeNull()
  })

  it('"Agora não" dispensa o aviso', async () => {
    useVerificacaoEmailStore.setState({ avisoPara: 'ana@gmail.com' })
    const aoVerificar = jest.fn()
    await renderizar(<AvisoVerificacaoEmail aoVerificar={aoVerificar} />)

    await fireEvent.press(screen.getByRole('button', { name: 'Agora não' }))

    expect(screen.queryByText(/Enviamos um código/)).toBeNull()
    expect(aoVerificar).not.toHaveBeenCalled()
  })
})
