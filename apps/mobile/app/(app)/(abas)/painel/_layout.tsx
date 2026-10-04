import { Redirect, Stack } from 'expo-router'
import { paleta } from '@/features/atletica'
import { useVePainel } from '@/infra/sessao/use-ve-painel'

export default function LayoutPainel() {
  const vePainel = useVePainel()
  if (!vePainel) return <Redirect href="/" />

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: paleta.superficie },
        headerTintColor: paleta.texto,
        contentStyle: { backgroundColor: paleta.fundo },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="usuarios/index" options={{ title: 'Usuários' }} />
      <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuário' }} />
    </Stack>
  )
}
