import { Stack } from 'expo-router'
import { paleta } from '@/features/atletica'

export const unstable_settings = { initialRouteName: '(abas)' }

const comCabecalho = {
  headerShown: true,
  headerStyle: { backgroundColor: paleta.superficie },
  headerTintColor: paleta.texto,
  contentStyle: { backgroundColor: paleta.fundo },
}

/** Abas e, acima delas, as telas de detalhe (eventos, notícias...). */
export default function LayoutApp() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(abas)" />
      <Stack.Screen name="eventos/[id]" options={{ ...comCabecalho, title: 'Evento' }} />
      <Stack.Screen name="noticias/index" options={{ ...comCabecalho, title: 'Notícias' }} />
      <Stack.Screen name="noticias/[id]" options={{ ...comCabecalho, title: 'Notícia' }} />
      <Stack.Screen
        name="verificar-email"
        options={{ ...comCabecalho, title: 'Verificar e-mail', presentation: 'modal' }}
      />
      <Stack.Screen
        name="ativar-notificacoes"
        options={{ presentation: 'modal', contentStyle: { backgroundColor: paleta.fundo } }}
      />
    </Stack>
  )
}
