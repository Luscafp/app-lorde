import { Stack } from 'expo-router'
import { paleta } from '@/features/atletica'

export default function LayoutPerfil() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: paleta.superficie },
        headerTintColor: paleta.texto,
        contentStyle: { backgroundColor: paleta.fundo },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="configuracoes/index" options={{ title: 'Configurações' }} />
      <Stack.Screen name="configuracoes/editar-perfil" options={{ title: 'Editar perfil' }} />
      <Stack.Screen name="configuracoes/alterar-senha" options={{ title: 'Alterar senha' }} />
    </Stack>
  )
}
