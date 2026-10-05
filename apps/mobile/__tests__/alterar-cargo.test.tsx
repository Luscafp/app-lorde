import type { Papel, PapelAlterado, UsuarioDetalhe } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert, type AlertButton } from 'react-native'
import { toast } from '@/components/ui/toast'
import { alterarPapel } from '@/features/usuarios/api'
import { AlterarCargoSheet } from '@/features/usuarios/alterar-cargo'
import { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

jest.mock('@/features/usuarios/api', () => ({ alterarPapel: jest.fn() }))

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

const ID = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const ADMIN_ID = 'ad000000-0000-4000-8000-000000000000'

function usuario(parcial: Partial<UsuarioDetalhe> = {}): UsuarioDetalhe {
  return {
    id: ID,
    nome: 'Bruno Lima',
    email: 'bruno@ex.com',
    fotoUrl: null,
    papel: 'DIRETOR',
    situacao: 'ATIVO',
    criadoEm: '2026-08-01T12:00:00.000Z',
    times: [],
    estatisticas: null,
    permissoes: {
      podeAlterarSituacao: true,
      motivoBloqueio: null,
      podeAlterarPapel: true,
      ehUltimoAdministrador: false,
    },
    ...parcial,
  }
}

const resposta = (papelAnterior: Papel, papel: Papel, id = ID): PapelAlterado => ({
  alterado: true,
  usuario: { id, papelAnterior, papel },
  substituido: null,
})

let cliente: QueryClient
let botoesDoAlerta: AlertButton[] = []
const aoFechar = jest.fn()
const atualizarUsuario = jest.fn()

async function abrir(alvo = usuario()) {
  await render(
    <QueryClientProvider client={cliente}>
      <AlterarCargoSheet usuario={alvo} aoFechar={aoFechar} />
    </QueryClientProvider>,
  )
}

const salvar = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
const escolher = (rotulo: string) => fireEvent.press(screen.getByRole('radio', { name: rotulo }))
const confirmarAlerta = () => act(() => botoesDoAlerta[1]?.onPress?.())

beforeEach(() => {
  jest.clearAllMocks()
  cliente = criarQueryClient()
  onlineManager.setOnline(true)
  useSessao.setState({
    usuario: {
      id: ADMIN_ID,
      nome: 'Admin',
      email: 'admin@ex.com',
      fotoUrl: null,
      papel: 'ADMINISTRADOR',
      atleticaId: 'a0000000-0000-4000-8000-000000000000',
    },
    atualizarUsuario,
  })
  jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes) => {
    botoesDoAlerta = botoes ?? []
  })
})

afterEach(() => cliente.clear())

describe('AlterarCargoSheet (#28)', () => {
  it('cinco cargos em ordem crescente, o atual marcado e Salvar desabilitado', async () => {
    await abrir()

    expect(
      screen
        .getAllByRole('radio')
        .map(({ props }) => (props as { accessibilityLabel: string }).accessibilityLabel),
    ).toEqual(['Atleta', 'Diretor(a)', 'Vice-presidente', 'Presidente', 'Administrador(a)'])
    expect(screen.getByRole('radio', { name: 'Diretor(a)' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()

    await escolher('Presidente')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('offline: Salvar desabilitado', async () => {
    onlineManager.setOnline(false)
    await abrir()
    await escolher('Atleta')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('último Administrador: aviso e opções diferentes de Administrador desabilitadas', async () => {
    await abrir(
      usuario({
        papel: 'ADMINISTRADOR',
        permissoes: { ...usuario().permissoes, ehUltimoAdministrador: true },
      }),
    )

    expect(
      screen.getByText('Este é o único Administrador ativo e não pode perder o cargo.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Diretor(a)' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Administrador(a)' })).toBeEnabled()
  })

  it('sucesso: toast, invalida usuários e fecha', async () => {
    jest.mocked(alterarPapel).mockResolvedValue(resposta('DIRETOR', 'ATLETA'))
    const invalidar = jest.spyOn(cliente, 'invalidateQueries')
    await abrir()

    await escolher('Atleta')
    await salvar()

    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
    expect(alterarPapel).toHaveBeenCalledWith(ID, {
      papel: 'ATLETA',
      confirmarSubstituicao: undefined,
    })
    expect(toast.sucesso).toHaveBeenCalledWith('Cargo alterado')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chaves.usuarios.todos() })
    expect(atualizarUsuario).not.toHaveBeenCalled()
  })

  it('409 SUBSTITUICAO_NECESSARIA → diálogo e reenvio com confirmarSubstituicao', async () => {
    const mensagem = 'Ana Souza é o(a) atual Presidente e passará a Diretor(a).'
    jest
      .mocked(alterarPapel)
      .mockRejectedValueOnce(
        new ApiErro({ status: 409, code: 'SUBSTITUICAO_NECESSARIA', message: mensagem }),
      )
      .mockResolvedValueOnce(resposta('DIRETOR', 'PRESIDENTE'))
    await abrir()

    await escolher('Presidente')
    await salvar()

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Substituir Presidente',
        mensagem,
        expect.any(Array),
      ),
    )
    expect(toast.erro).not.toHaveBeenCalled()
    await confirmarAlerta()

    await waitFor(() => expect(aoFechar).toHaveBeenCalled())
    expect(alterarPapel).toHaveBeenLastCalledWith(ID, {
      papel: 'PRESIDENTE',
      confirmarSubstituicao: true,
    })
  })

  it.each(['ULTIMO_ADMINISTRADOR', 'USUARIO_DESATIVADO', 'CONFLITO_CONCORRENTE'])(
    '409 %s → caixa de erro no sheet, sem toast',
    async (code) => {
      jest
        .mocked(alterarPapel)
        .mockRejectedValue(new ApiErro({ status: 409, code, message: `Falhou: ${code}` }))
      await abrir()

      await escolher('Atleta')
      await salvar()

      expect(await screen.findByText(`Falhou: ${code}`)).toBeOnTheScreen()
      expect(toast.erro).not.toHaveBeenCalled()
      expect(aoFechar).not.toHaveBeenCalled()
    },
  )

  it('auto-rebaixamento: diálogo extra, atualiza a sessão e sai do Painel', async () => {
    jest.mocked(alterarPapel).mockResolvedValue(resposta('ADMINISTRADOR', 'ATLETA', ADMIN_ID))
    const invalidar = jest.spyOn(cliente, 'invalidateQueries')
    await abrir(usuario({ id: ADMIN_ID, papel: 'ADMINISTRADOR' }))

    await escolher('Atleta')
    await salvar()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Alterar o próprio cargo',
      'Você perderá o acesso de Administrador.',
      expect.any(Array),
    )
    expect(alterarPapel).not.toHaveBeenCalled()
    await confirmarAlerta()

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(app)/(abas)/perfil'))
    expect(atualizarUsuario).toHaveBeenCalledWith({ papel: 'ATLETA' })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: chaves.me() })
  })

  it('auto-rebaixamento a Presidente: continua no Painel', async () => {
    jest.mocked(alterarPapel).mockResolvedValue(resposta('ADMINISTRADOR', 'PRESIDENTE', ADMIN_ID))
    await abrir(usuario({ id: ADMIN_ID, papel: 'ADMINISTRADOR' }))

    await escolher('Presidente')
    await salvar()
    await confirmarAlerta()

    await waitFor(() => expect(atualizarUsuario).toHaveBeenCalledWith({ papel: 'PRESIDENTE' }))
    expect(router.replace).not.toHaveBeenCalled()
  })
})
