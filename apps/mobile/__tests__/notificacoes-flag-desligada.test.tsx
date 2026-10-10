import AsyncStorage from '@react-native-async-storage/async-storage'
import { Papel, type AtleticaPublica } from '@atletica/shared'
import * as Notifications from 'expo-notifications'
import { renderRouter, screen } from 'expo-router/testing-library'
import { Text } from 'react-native'
import * as rotaApp from '../app/(app)/_layout'
import * as rotaPublica from '../app/(publico)/_layout'
import LayoutRaiz from '../app/_layout'
import { CHAVE_CACHE_ATLETICA } from '@/features/atletica/api'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/config/features', () => ({
  features: { notificacoes: false, avisosHabilitados: false },
}))

const atletica: AtleticaPublica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Teste',
  sigla: 'AT',
  curso: null,
  logoUrl: null,
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: 'diretoria@exemplo.com',
  contatoInstagram: null,
  contatoWhatsapp: null,
}

const rotas = {
  _layout: LayoutRaiz,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': () => <Text accessibilityRole="header">Entrar</Text>,
  '(app)/_layout': rotaApp,
  '(app)/(abas)/index': () => <Text accessibilityRole="header">Início</Text>,
}

it('flag "notificacoes" desligada: o app abre autenticado sem chamar nenhuma API de push', async () => {
  global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')))
  await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
  await useSessao.getState().iniciarSessao({
    accessToken: 'access',
    refreshToken: 'refresh',
    accessTokenExpiraEm: new Date(Date.now() + 15 * 60_000).toISOString(),
    usuario: {
      id: '0b0f5c0e-6a43-4c55-9d3a-0d7f8d6c4f11',
      nome: 'Ana',
      email: 'ana@exemplo.com',
      fotoUrl: null,
      papel: Papel.ATLETA,
      atleticaId: atletica.id,
    },
  })
  useSessao.setState({ status: 'carregando' })

  await renderRouter(rotas, { initialUrl: '/' })

  expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
  const chamadas = Object.entries(Notifications)
    .filter(([, valor]) => jest.isMockFunction(valor) && valor.mock.calls.length > 0)
    .map(([nome]) => nome)
  expect(chamadas).toEqual([])
})
