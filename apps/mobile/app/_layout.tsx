import '../global.css'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack, useNavigationContainerRef, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { LimiteErro } from '@/components/estado'
import { toastConfig } from '@/components/ui'
import { carregarAtletica, paleta, ProvedorTema } from '@/features/atletica'
import { acompanharLogoutPendente } from '@/features/auth'
import { queryClient } from '@/infra/query/query-client'
import { configurarRede } from '@/infra/rede/online'
import { iniciarSentry, integracaoNavegacao } from '@/infra/sentry'
import { consumirDestinoAposLogin } from '@/infra/sessao/destino'
import { useSessao } from '@/infra/sessao/store'

iniciarSentry()
void SplashScreen.preventAutoHideAsync()
configurarRede()
acompanharLogoutPendente()

/** Deep link protegido aberto sem sessão: depois do login, vai ao destino original. */
function useIrAoDestinoAposLogin() {
  const router = useRouter()
  const status = useSessao((estado) => estado.status)
  const anterior = useRef(status)

  useEffect(() => {
    if (status === 'autenticado') {
      const destino = consumirDestinoAposLogin()
      if (destino && anterior.current === 'anonimo') router.replace(destino)
    }
    anterior.current = status
  }, [status, router])
}

function Navegacao() {
  const autenticado = useSessao((estado) => estado.status === 'autenticado')
  useIrAoDestinoAposLogin()

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paleta.fundo } }}>
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

  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync()
  }, [pronto])

  if (!pronto) return null

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ProvedorTema>
          <StatusBar style="light" />
          <LimiteErro>
            <Navegacao />
          </LimiteErro>
        </ProvedorTema>
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}

export default Sentry.wrap(LayoutRaiz)
