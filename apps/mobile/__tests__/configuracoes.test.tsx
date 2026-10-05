import fs from 'node:fs'
import path from 'node:path'
import { termosDeUso, TERMOS_VERSAO, type AtleticaPublica, type Perfil } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import type { ReactElement } from 'react'
import { Alert, Linking } from 'react-native'
import * as apiAtletica from '@/features/atletica/api'
import {
  MENSAGEM_SEM_CONTATO,
  ROTAS_CONFIGURACOES,
  TelaConfiguracoes,
  TelaSobre,
} from '@/features/configuracoes'
import { MENSAGEM_VERSAO_NOVA, TelaDocumentoLegal } from '@/features/legal'
import * as apiPerfil from '@/features/perfil/api'
import { MENSAGEM_SEM_CONEXAO } from '@/components/estado'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('expo-application', () => {
  const estado = { versao: null as string | null, build: null as string | null }
  return {
    __estado: estado,
    get nativeApplicationVersion() {
      return estado.versao
    },
    get nativeBuildVersion() {
      return estado.build
    },
  }
})
jest.mock('expo-updates', () => {
  const estado = { id: null as string | null, canal: null as string | null }
  return {
    __estado: estado,
    get updateId() {
      return estado.id
    },
    get channel() {
      return estado.canal
    },
  }
})
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false, back: jest.fn() }) }))
jest.mock('@/features/atletica/api', () => ({
  ...jest.requireActual<object>('@/features/atletica/api'),
  buscarAtletica: jest.fn(),
}))
jest.mock('@/features/perfil/api')

type Mutavel<T> = { __estado: T }
const aplicativo = (
  Application as unknown as Mutavel<{ versao: string | null; build: string | null }>
).__estado
const atualizacoes = (Updates as unknown as Mutavel<{ id: string | null; canal: string | null }>)
  .__estado
const buscarAtletica = jest.mocked(apiAtletica.buscarAtletica)
const buscarPerfil = jest.mocked(apiPerfil.buscarPerfil)

function atletica(parcial: Partial<AtleticaPublica> = {}): AtleticaPublica {
  return {
    id: '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
    nome: 'Atlética Teste',
    sigla: 'AT',
    curso: 'Engenharia',
    logoUrl: null,
    corPrimaria: '#E11D48',
    corSecundaria: '#2563EB',
    contatoEmail: 'diretoria@exemplo.com',
    contatoInstagram: null,
    contatoWhatsapp: null,
    ...parcial,
  }
}

function perfil(termosAceitos: Perfil['termosAceitos']): Perfil {
  return {
    id: '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    emailVerificado: true,
    papel: 'ATLETA',
    atletica: { id: '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b', nome: 'Atlética Teste', sigla: 'AT' },
    times: [],
    termosAceitos,
    criadoEm: '2026-08-01T12:00:00.000Z',
  }
}

let cliente: QueryClient

function renderizar(elemento: ReactElement) {
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>)
}

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  aplicativo.versao = '1.0.0'
  aplicativo.build = '12'
  atualizacoes.id = null
  atualizacoes.canal = null
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: 'u1',
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

describe('Tela Configurações', () => {
  it('seções Conta e Sobre, "Sair da conta" e "Excluir conta", sem Notificações (critérios 1 e 2)', async () => {
    await renderizar(<TelaConfiguracoes aoAbrir={jest.fn()} />)

    expect(screen.getByRole('header', { name: 'Conta' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Sobre' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeOnTheScreen()
    expect(screen.queryByText(/Notifica/)).toBeNull()
  })

  it.each([
    ['Editar perfil', '/perfil/configuracoes/editar-perfil'],
    ['Alterar senha', '/perfil/configuracoes/alterar-senha'],
    ['Termos de Uso', '/termos'],
    ['Política de Privacidade', '/privacidade'],
    ['Sobre o aplicativo', '/perfil/configuracoes/sobre'],
    ['Excluir conta', '/perfil/configuracoes/excluir-conta'],
  ])('"%s" abre %s (critérios 3 e 9)', async (rotulo, rota) => {
    const aoAbrir = jest.fn()
    await renderizar(<TelaConfiguracoes aoAbrir={aoAbrir} />)

    await fireEvent.press(screen.getByRole('button', { name: rotulo }))
    expect(aoAbrir).toHaveBeenCalledWith(rota)
  })

  it('toda rota de Configurações tem arquivo em app/', () => {
    const raiz = path.resolve(__dirname, '../app')
    const arquivo = (rota: string) =>
      rota.startsWith('/perfil')
        ? path.join(raiz, '(app)/(abas)', `${rota}.tsx`)
        : path.join(raiz, `${rota}.tsx`)

    for (const rota of Object.values(ROTAS_CONFIGURACOES)) {
      expect(fs.existsSync(arquivo(rota))).toBe(true)
    }
  })

  it('"Sair da conta" pede a confirmação da #60 (critério 8)', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    await renderizar(<TelaConfiguracoes aoAbrir={jest.fn()} />)

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(alerta).toHaveBeenCalledWith(
      'Sair da conta',
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Sair' })]),
    )
  })
})

describe('Termos com versão aceita', () => {
  it('mostra a versão e a data aceitas acima do texto (critério 4)', async () => {
    buscarPerfil.mockResolvedValue(
      perfil({ versao: TERMOS_VERSAO, aceitoEm: '2026-10-02T15:00:00.000Z' }),
    )
    await renderizar(<TelaDocumentoLegal documento={termosDeUso} />)

    expect(
      await screen.findByText(`Você aceitou a versão ${TERMOS_VERSAO} em 02/10/2026`),
    ).toBeOnTheScreen()
    expect(screen.queryByText(MENSAGEM_VERSAO_NOVA)).toBeNull()
  })

  it('data no fuso America/Fortaleza: 01:30Z cai no dia anterior', async () => {
    buscarPerfil.mockResolvedValue(
      perfil({ versao: TERMOS_VERSAO, aceitoEm: '2026-10-02T01:30:00.000Z' }),
    )
    await renderizar(<TelaDocumentoLegal documento={termosDeUso} />)

    expect(await screen.findByText(/em 01\/10\/2026$/)).toBeOnTheScreen()
  })

  it('aceite de versão antiga mostra o aviso de versão mais recente (critério 5)', async () => {
    buscarPerfil.mockResolvedValue(
      perfil({ versao: '2025-01-15', aceitoEm: '2025-01-20T15:00:00.000Z' }),
    )
    await renderizar(<TelaDocumentoLegal documento={termosDeUso} />)

    expect(await screen.findByText(MENSAGEM_VERSAO_NOVA)).toBeOnTheScreen()
  })

  it('sem sessão não consulta o perfil', async () => {
    useSessao.setState({ status: 'anonimo', usuario: null })
    await renderizar(<TelaDocumentoLegal documento={termosDeUso} />)

    expect(screen.getByText('Texto provisório')).toBeOnTheScreen()
    expect(buscarPerfil).not.toHaveBeenCalled()
  })
})

describe('Tela Sobre', () => {
  it('versão instalada, nome, sigla, curso e contato da atlética (critérios 6 e 12)', async () => {
    buscarAtletica.mockResolvedValue(atletica())
    await renderizar(<TelaSobre />)

    expect(await screen.findByText('Atlética Teste')).toBeOnTheScreen()
    expect(screen.getByText('AT')).toBeOnTheScreen()
    expect(screen.getByText('Engenharia')).toBeOnTheScreen()
    expect(screen.getByText('1.0.0 (build 12)')).toBeOnTheScreen()
    expect(screen.queryByText(/lorde/i)).toBeNull()
  })

  it('identificador curto do OTA e canal fora de produção', async () => {
    atualizacoes.id = '0123456789abcdef'
    atualizacoes.canal = 'homologacao'
    buscarAtletica.mockResolvedValue(atletica())
    await renderizar(<TelaSobre />)

    expect(screen.getByText('Atualização 01234567 · homologacao')).toBeOnTheScreen()
  })

  it('não mostra o canal de produção', async () => {
    atualizacoes.id = '0123456789abcdef'
    atualizacoes.canal = 'production'
    buscarAtletica.mockResolvedValue(atletica())
    await renderizar(<TelaSobre />)

    expect(screen.getByText('Atualização 01234567')).toBeOnTheScreen()
  })

  it('tocar no e-mail abre o app de e-mail (critério 7)', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    buscarAtletica.mockResolvedValue(atletica())
    await renderizar(<TelaSobre />)

    await fireEvent.press(await screen.findByRole('button', { name: 'diretoria@exemplo.com' }))
    expect(abrir).toHaveBeenCalledWith('mailto:diretoria@exemplo.com')
  })

  it.each([null, 'javascript:alert(1)'])(
    'contato %s: "Contato não informado" e item não tocável (critério 7)',
    async (contatoEmail) => {
      buscarAtletica.mockResolvedValue(atletica({ contatoEmail }))
      await renderizar(<TelaSobre />)

      expect(await screen.findByText(MENSAGEM_SEM_CONTATO)).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: MENSAGEM_SEM_CONTATO })).toBeNull()
    },
  )

  it('WhatsApp e Instagram aparecem quando informados', async () => {
    buscarAtletica.mockResolvedValue(
      atletica({ contatoWhatsapp: '+5598999999999', contatoInstagram: '@atletica' }),
    )
    await renderizar(<TelaSobre />)

    expect(await screen.findByText('+5598999999999')).toBeOnTheScreen()
    expect(screen.getByText('@atletica')).toBeOnTheScreen()
  })

  it('offline com cache: dados e faixa offline (critério 10)', async () => {
    const atualizadoEm = Date.parse('2026-10-02T15:00:00.000Z')
    cliente.setQueryData(chaves.atletica(), atletica(), { updatedAt: atualizadoEm })
    onlineManager.setOnline(false)
    await renderizar(<TelaSobre />)

    expect(screen.getByText('Atlética Teste')).toBeOnTheScreen()
    expect(screen.getByText('Modo offline · dados de 02/10/2026 12:00')).toBeOnTheScreen()
  })

  it('offline sem cache: versão aparece e o bloco da atlética mostra o erro (critério 11)', async () => {
    onlineManager.setOnline(false)
    await renderizar(<TelaSobre />)

    expect(screen.getByText('1.0.0 (build 12)')).toBeOnTheScreen()
    expect(screen.getByText(MENSAGEM_SEM_CONEXAO)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })
})
