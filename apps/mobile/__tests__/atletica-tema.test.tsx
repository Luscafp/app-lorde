import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AtleticaPublica } from '@atletica/shared'
import { act, render, renderHook, screen } from '@testing-library/react-native'
import * as nativewind from 'nativewind'
import { StyleSheet, Text } from 'react-native'
import { carregarAtletica, corTextoSobre, ProvedorTema, useAtletica } from '@/features/atletica'
import { CHAVE_CACHE_ATLETICA } from '@/features/atletica/api'
import { atleticaStore } from '@/features/atletica/carregar-atletica'
import { hexParaRgb } from '@/features/atletica/cores'
import { variaveisTema } from '@/features/atletica/provedor-tema'
import { COR_NEUTRA, NOME_GENERICO } from '@/features/atletica/use-atletica'

const atletica: AtleticaPublica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Exemplo',
  sigla: 'EXEMPLO',
  curso: 'Computação',
  logoUrl: null,
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: null,
  contatoInstagram: null,
  contatoWhatsapp: null,
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()

function responder(corpo: unknown, status = 200) {
  fetchMock.mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(corpo),
  } as Response)
}

beforeEach(async () => {
  global.fetch = fetchMock
  fetchMock.mockReset()
  await AsyncStorage.clear()
  atleticaStore.setState({ dados: null })
})

describe('cores', () => {
  it('converte hex para "R G B"', () => {
    expect(hexParaRgb('#E11D48')).toBe('225 29 72')
    expect(hexParaRgb('#6b7280')).toBe('107 114 128')
  })

  it.each([
    ['#E11D48', '#FFFFFF'],
    ['#2563EB', '#FFFFFF'],
    ['#000000', '#FFFFFF'],
    ['#FFFFFF', '#000000'],
    ['#FACC15', '#000000'],
    ['#6B7280', '#FFFFFF'],
  ])('corTextoSobre(%s) = %s', (fundo, texto) => {
    expect(corTextoSobre(fundo)).toBe(texto)
  })

  it('rejeita cor inválida', () => {
    expect(() => hexParaRgb('vermelho')).toThrow('Cor inválida')
  })
})

describe('carregarAtletica', () => {
  it('aplica a resposta da API e grava o cache atletica.v1', async () => {
    responder(atletica)

    await carregarAtletica()

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toMatch(/\/atletica$/)
    expect(JSON.stringify(init?.headers)).not.toContain('Authorization')
    const { result } = await renderHook(() => useAtletica())
    expect(result.current).toEqual(atletica)
    expect(JSON.parse((await AsyncStorage.getItem(CHAVE_CACHE_ATLETICA)) ?? '')).toEqual(atletica)
  })

  it('usa o cache na hora, sem esperar a rede, e atualiza em segundo plano', async () => {
    await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
    let liberarRede: (resposta: Response) => void = () => undefined
    fetchMock.mockReturnValue(new Promise<Response>((resolver) => (liberarRede = resolver)))

    await carregarAtletica()
    expect(atleticaStore.getState().dados?.corPrimaria).toBe('#E11D48')

    const atualizada = { ...atletica, corPrimaria: '#16A34A' }
    await act(async () => {
      liberarRede({ ok: true, status: 200, json: () => Promise.resolve(atualizada) } as Response)
      await new Promise((resolver) => setImmediate(resolver))
    })
    expect(atleticaStore.getState().dados?.corPrimaria).toBe('#16A34A')
  })

  it('sem rede e sem cache usa o fallback neutro sem travar', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    await carregarAtletica()

    const { result } = await renderHook(() => useAtletica())
    expect(result.current).toMatchObject({
      id: null,
      nome: NOME_GENERICO,
      corPrimaria: COR_NEUTRA,
      corSecundaria: COR_NEUTRA,
    })
  })

  it('sem rede e com cache usa o cache', async () => {
    await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    await carregarAtletica()

    expect(atleticaStore.getState().dados).toEqual(atletica)
  })

  it('aborta a busca depois de 3 s', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolver, rejeitar) => {
          init?.signal?.addEventListener('abort', () => rejeitar(new Error('abortada')))
        }),
    )

    const carga = carregarAtletica()
    await jest.advanceTimersByTimeAsync(3000)
    await carga
    jest.useRealTimers()

    expect(atleticaStore.getState().dados).toBeNull()
  })

  it('ignora resposta fora do contrato', async () => {
    responder({ ...atletica, corPrimaria: 'vermelho' })

    await carregarAtletica()

    expect(atleticaStore.getState().dados).toBeNull()
    expect(await AsyncStorage.getItem(CHAVE_CACHE_ATLETICA)).toBeNull()
  })

  it('cor nula na API cai no neutro', async () => {
    atleticaStore.setState({ dados: { ...atletica, corSecundaria: null } })
    const { result } = await renderHook(() => useAtletica())
    expect(result.current.corSecundaria).toBe(COR_NEUTRA)
  })
})

describe('ProvedorTema', () => {
  it('gera as variáveis --cor-primaria e --cor-secundaria', () => {
    expect(variaveisTema({ corPrimaria: '#E11D48', corSecundaria: '#2563EB' })).toEqual({
      '--cor-primaria': '225 29 72',
      '--cor-secundaria': '37 99 235',
    })
  })

  it('aplica as variáveis da atlética no contêiner raiz', async () => {
    // O objeto de vars() é opaco fora do Metro; o espião expõe o que chega ao contêiner.
    const espiao = jest
      .spyOn(nativewind, 'vars')
      .mockImplementation((v) => ({ variaveis: JSON.stringify(v) }))
    atleticaStore.setState({ dados: atletica })
    await render(
      <ProvedorTema>
        <Text>conteúdo</Text>
      </ProvedorTema>,
    )

    expect(StyleSheet.flatten(screen.getByTestId('provedor-tema').props.style)).toEqual({
      variaveis: JSON.stringify({ '--cor-primaria': '225 29 72', '--cor-secundaria': '37 99 235' }),
    })
    expect(screen.getByText('conteúdo')).toBeOnTheScreen()
    espiao.mockRestore()
  })
})
