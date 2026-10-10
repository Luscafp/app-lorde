import '../global.css'
import * as Sentry from '@sentry/react-native'
import { useIsRestoring } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack, useNavigationContainerRef, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { LimiteErro } from '@/components/estado'
import { toastConfig } from '@/components/ui'
import { carregarAtletica, paleta, ProvedorTema } from '@/features/atletica'
import { acompanharLogoutPendente } from '@/features/auth'
import {
  iniciarNotificacoes,
  oferecerAtivacaoNotificacoes,
  OuvinteDeepLinkNotificacao,
} from '@/features/notificacoes'
import { opcoesPersistencia } from '@/infra/query/persistencia'
import { queryClient } from '@/infra/query/query-client'
import { configurarRede } from '@/infra/rede/online'
import {
  iniciarSentry,
  iniciarSpanAbertura,
  iniciarSpanRestauracao,
  integracaoNavegacao,
} from '@/infra/sentry'
import { consumirDestinoAposLogin } from '@/infra/sessao/destino'
import { useSessao } from '@/infra/sessao/store'

iniciarSentry()
iniciarSpanAbertura()
void SplashScreen.preventAutoHideAsync()
configurarRede()
acompanharLogoutPendente()
iniciarNotificacoes()

/** Depois do login: vai ao destino guardado e só então oferece a pré-permissão por cima dele. */
function useAposLogin() {
  const router = useRouter()
  const status = useSessao((estado) => estado.status)
  const anterior = useRef(status)

  useEffect(() => {
    if (status === 'autenticado') {
      const destino = consumirDestinoAposLogin()
      if (anterior.current === 'anonimo') {
        if (destino) router.replace(destino)
        void oferecerAtivacaoNotificacoes()
      }
    }
    anterior.current = status
  }, [status, router])
}

function Navegacao() {
  const autenticado = useSessao((estado) => estado.status === 'autenticado')
  useAposLogin()

  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paleta.fundo } }}
      >
        <Stack.Protected guard={autenticado}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!autenticado}>
          <Stack.Screen name="(publico)" />
        </Stack.Protected>
        <Stack.Screen name="termos" />
        <Stack.Screen name="privacidade" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <OuvinteDeepLinkNotificacao />
    </>
  )
}

/** A splash cobre a restauração do cache: nada de esqueleto com a tela vazia. */
function AposRestaurar({ children }: { children: ReactNode }) {
  const restaurando = useIsRestoring()

  useEffect(() => {
    if (!restaurando) void SplashScreen.hideAsync()
  }, [restaurando])

  return restaurando ? null : children
}

function ProvedorQuery({ children }: { children: ReactNode }) {
  const [fimRestauracao] = useState(iniciarSpanRestauracao)

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={opcoesPersistencia}
      onSuccess={fimRestauracao}
      onError={fimRestauracao}
    >
      <AposRestaurar>{children}</AposRestaurar>
    </PersistQueryClientProvider>
  )
}

function LayoutRaiz() {
  const navegacao = useNavigationContainerRef()
  const sessaoCarregada = useSessao((estado) => estado.status !== 'carregando')
  const [atleticaCarregada, setAtleticaCarregada] = useState(false)
  const pronto = sessaoCarregada && atleticaCarregada

  useEffect(() => {
    integracaoNavegacao.registerNavigationContainer(navegacao)
  }, [navegacao])

  useEffect(() => {
    void useSessao.getState().carregarSessao()
    void carregarAtletica().then(() => setAtleticaCarregada(true))
  }, [])

  if (!pronto) return null

  return (
    <ProvedorQuery>
      <SafeAreaProvider>
        <ProvedorTema>
          <StatusBar style="light" />
          <LimiteErro>
            <Navegacao />
          </LimiteErro>
        </ProvedorTema>
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </ProvedorQuery>
  )
}

export default Sentry.wrap(LayoutRaiz)
