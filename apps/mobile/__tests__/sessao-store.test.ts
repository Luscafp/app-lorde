import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import {
  aoEncerrarSessao,
  CHAVE_ACCESS_TOKEN,
  CHAVE_DADOS_SESSAO,
  CHAVE_REFRESH_TOKEN,
  useSessao,
  type DadosSessao,
} from '@/infra/sessao/store'

const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens

const dados: DadosSessao = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiraEm: '2026-10-01T22:15:00.000Z',
  usuario: {
    id: 'u1',
    nome: 'Ana',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    papel: 'DIRETOR',
    atleticaId: 'a1',
  },
}

async function conteudoAsyncStorage(): Promise<string> {
  const chaves = await AsyncStorage.getAllKeys()
  const pares = await AsyncStorage.multiGet(chaves)
  return JSON.stringify(pares)
}

beforeEach(async () => {
  itensSeguros.clear()
  await AsyncStorage.clear()
  useSessao.setState({
    status: 'carregando',
    usuario: null,
    accessToken: null,
    refreshToken: null,
    accessTokenExpiraEm: null,
  })
})

describe('store de sessão', () => {
  it('iniciarSessao grava os tokens só no SecureStore e o usuário no AsyncStorage', async () => {
    await useSessao.getState().iniciarSessao(dados)

    expect(itensSeguros.get(CHAVE_ACCESS_TOKEN)).toBe('access-1')
    expect(itensSeguros.get(CHAVE_REFRESH_TOKEN)).toBe('refresh-1')
    const persistido = await conteudoAsyncStorage()
    expect(persistido).not.toContain('access-1')
    expect(persistido).not.toContain('refresh-1')
    expect(JSON.parse((await AsyncStorage.getItem(CHAVE_DADOS_SESSAO)) ?? '')).toEqual({
      usuario: dados.usuario,
      accessTokenExpiraEm: dados.accessTokenExpiraEm,
    })
    expect(useSessao.getState()).toMatchObject({ status: 'autenticado', ...dados })
  })

  it('atualizarUsuario mescla e persiste', async () => {
    await useSessao.getState().iniciarSessao(dados)
    await useSessao.getState().atualizarUsuario({ papel: 'ATLETA' })

    expect(useSessao.getState().usuario).toEqual({ ...dados.usuario, papel: 'ATLETA' })
    const persistido = JSON.parse((await AsyncStorage.getItem(CHAVE_DADOS_SESSAO)) ?? '') as {
      usuario: { papel: string }
    }
    expect(persistido.usuario.papel).toBe('ATLETA')
  })

  it('atualizarUsuario sem sessão não faz nada', async () => {
    await useSessao.getState().atualizarUsuario({ nome: 'X' })
    expect(useSessao.getState().usuario).toBeNull()
    expect(await AsyncStorage.getItem(CHAVE_DADOS_SESSAO)).toBeNull()
  })

  it('atualizarTokens troca os tokens no SecureStore e a validade', async () => {
    await useSessao.getState().iniciarSessao(dados)
    const novos = {
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      accessTokenExpiraEm: '2026-10-01T22:30:00.000Z',
    }
    await useSessao.getState().atualizarTokens(novos)

    expect(itensSeguros.get(CHAVE_ACCESS_TOKEN)).toBe('access-2')
    expect(itensSeguros.get(CHAVE_REFRESH_TOKEN)).toBe('refresh-2')
    expect(useSessao.getState()).toMatchObject(novos)
    expect(await conteudoAsyncStorage()).not.toContain('access-2')
  })

  it('encerrarSessao apaga SecureStore e AsyncStorage, fica anônima e avisa os ouvintes', async () => {
    await useSessao.getState().iniciarSessao(dados)
    const ouvinte = jest.fn()
    const comErro = jest.fn(() => Promise.reject(new Error('falhou')))
    const remover = aoEncerrarSessao(ouvinte)
    const removerComErro = aoEncerrarSessao(comErro)

    await useSessao.getState().encerrarSessao({ motivo: 'SESSAO_EXPIRADA' })

    expect(itensSeguros.size).toBe(0)
    expect(await AsyncStorage.getItem(CHAVE_DADOS_SESSAO)).toBeNull()
    expect(useSessao.getState()).toMatchObject({
      status: 'anonimo',
      usuario: null,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiraEm: null,
    })
    expect(ouvinte).toHaveBeenCalledWith({ motivo: 'SESSAO_EXPIRADA' })
    expect(comErro).toHaveBeenCalled()

    remover()
    removerComErro()
    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  describe('carregarSessao', () => {
    it('restaura a sessão do SecureStore e do AsyncStorage', async () => {
      await useSessao.getState().iniciarSessao(dados)
      useSessao.setState({ status: 'carregando', usuario: null, accessToken: null })

      await useSessao.getState().carregarSessao()

      expect(useSessao.getState()).toMatchObject({ status: 'autenticado', ...dados })
    })

    it('sem refresh token fica anônima', async () => {
      await useSessao.getState().iniciarSessao(dados)
      itensSeguros.delete(CHAVE_REFRESH_TOKEN)

      await useSessao.getState().carregarSessao()

      expect(useSessao.getState()).toMatchObject({ status: 'anonimo', usuario: null })
    })

    it('com dados corrompidos fica anônima', async () => {
      itensSeguros.set(CHAVE_REFRESH_TOKEN, 'refresh-1')
      await AsyncStorage.setItem(CHAVE_DADOS_SESSAO, '{corrompido')

      await useSessao.getState().carregarSessao()

      expect(useSessao.getState().status).toBe('anonimo')
    })
  })
})
