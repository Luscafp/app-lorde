import '../global.css'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { carregarAtletica, paleta, ProvedorTema } from '@/features/atletica'
import { consumirDestinoAposLogin } from '@/infra/sessao/destino'
import { useSessao } from '@/infra/sessao/store'

void SplashScreen.preventAutoHideAsync()

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
      <Stack.Screen name="+not-found" />
    </Stack>
  )
}

export default function LayoutRaiz() {
  const sessaoCarregada = useSessao((estado) => estado.status !== 'carregando')
  const [atleticaCarregada, setAtleticaCarregada] = useState(false)
  const pronto = sessaoCarregada && atleticaCarregada

  useEffect(() => {
    void useSessao.getState().carregarSessao()
    void carregarAtletica().then(() => setAtleticaCarregada(true))
  }, [])

  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync()
  }, [pronto])

  if (!pronto) return null

  return (
    <SafeAreaProvider>
      <ProvedorTema>
        <StatusBar style="light" />
        <Navegacao />
      </ProvedorTema>
      <Toast />
    </SafeAreaProvider>
  )
}
