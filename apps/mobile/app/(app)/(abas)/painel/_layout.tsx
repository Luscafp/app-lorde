import { Redirect, Stack } from 'expo-router'
import { paleta } from '@/features/atletica'
import { useVePainel } from '@/infra/sessao/use-ve-painel'

/** Todas as telas de gestão; a autorização real é da API (convenções §10.1). */
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
      <Stack.Screen name="index" options={{ title: 'Painel', headerShown: false }} />
      <Stack.Screen name="modalidades/index" options={{ title: 'Modalidades' }} />
      <Stack.Screen name="modalidades/nova" options={{ title: 'Nova modalidade' }} />
      <Stack.Screen name="modalidades/[id]" options={{ title: 'Editar modalidade' }} />
    </Stack>
  )
}
