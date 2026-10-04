import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Papel } from '@atletica/shared'
import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

export const CHAVE_ACCESS_TOKEN = 'auth.accessToken'
export const CHAVE_REFRESH_TOKEN = 'auth.refreshToken'
export const CHAVE_DADOS_SESSAO = 'sessao.v1'

export type UsuarioSessao = {
  id: string
  nome: string
  email: string
  fotoUrl: string | null
  papel: Papel
  atleticaId: string
}

export type TokensSessao = {
  accessToken: string
  refreshToken: string
  accessTokenExpiraEm: string
}

export type DadosSessao = TokensSessao & { usuario: UsuarioSessao }

export type StatusSessao = 'carregando' | 'autenticado' | 'anonimo'

export type MotivoEncerramento =
  'LOGOUT' | 'SESSAO_EXPIRADA' | 'CONTA_DESATIVADA' | 'CONTA_EXCLUIDA'

export type OuvinteEncerramento = (evento: { motivo: MotivoEncerramento }) => void | Promise<void>

type DadosPersistidos = { usuario: UsuarioSessao; accessTokenExpiraEm: string | null }

type EstadoSessao = {
  status: StatusSessao
  usuario: UsuarioSessao | null
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiraEm: string | null
  carregarSessao: () => Promise<void>
  iniciarSessao: (dados: DadosSessao) => Promise<void>
  atualizarUsuario: (parcial: Partial<UsuarioSessao>) => Promise<void>
  atualizarTokens: (tokens: TokensSessao) => Promise<void>
  encerrarSessao: (opcoes: { motivo: MotivoEncerramento }) => Promise<void>
}

const SEM_SESSAO = {
  status: 'anonimo',
  usuario: null,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiraEm: null,
} as const

const ouvintes = new Set<OuvinteEncerramento>()

/** Registra um ouvinte chamado depois de `encerrarSessao`. Devolve a função que o remove. */
export function aoEncerrarSessao(ouvinte: OuvinteEncerramento): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

async function persistir(dados: DadosPersistidos): Promise<void> {
  await AsyncStorage.setItem(CHAVE_DADOS_SESSAO, JSON.stringify(dados))
}

async function gravarTokens({ accessToken, refreshToken }: TokensSessao): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_ACCESS_TOKEN, accessToken)
  await SecureStore.setItemAsync(CHAVE_REFRESH_TOKEN, refreshToken)
}

/**
 * Store de sessão (convenções §10.6). Tokens só no SecureStore; o resto no AsyncStorage.
 * Fora do React: `useSessao.getState()`.
 */
export const useSessao = create<EstadoSessao>()((set, get) => ({
  status: 'carregando',
  usuario: null,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiraEm: null,

  carregarSessao: async () => {
    try {
      const [accessToken, refreshToken, bruto] = await Promise.all([
        SecureStore.getItemAsync(CHAVE_ACCESS_TOKEN),
        SecureStore.getItemAsync(CHAVE_REFRESH_TOKEN),
        AsyncStorage.getItem(CHAVE_DADOS_SESSAO),
      ])
      const dados = bruto ? (JSON.parse(bruto) as DadosPersistidos) : null
      if (!refreshToken || !dados?.usuario) {
        set(SEM_SESSAO)
        return
      }
      set({
        status: 'autenticado',
        usuario: dados.usuario,
        accessToken,
        refreshToken,
        accessTokenExpiraEm: dados.accessTokenExpiraEm,
      })
    } catch {
      set(SEM_SESSAO)
    }
  },

  iniciarSessao: async ({ usuario, ...tokens }) => {
    await gravarTokens(tokens)
    await persistir({ usuario, accessTokenExpiraEm: tokens.accessTokenExpiraEm })
    set({ status: 'autenticado', usuario, ...tokens })
  },

  atualizarUsuario: async (parcial) => {
    const atual = get().usuario
    if (!atual) return
    const usuario = { ...atual, ...parcial }
    set({ usuario })
    await persistir({ usuario, accessTokenExpiraEm: get().accessTokenExpiraEm })
  },

  atualizarTokens: async (tokens) => {
    await gravarTokens(tokens)
    set(tokens)
    const usuario = get().usuario
    if (usuario) await persistir({ usuario, accessTokenExpiraEm: tokens.accessTokenExpiraEm })
  },

  encerrarSessao: async ({ motivo }) => {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(CHAVE_ACCESS_TOKEN),
      SecureStore.deleteItemAsync(CHAVE_REFRESH_TOKEN),
      AsyncStorage.removeItem(CHAVE_DADOS_SESSAO),
    ])
    set(SEM_SESSAO)
    await Promise.allSettled([...ouvintes].map(async (ouvinte) => ouvinte({ motivo })))
  },
}))
