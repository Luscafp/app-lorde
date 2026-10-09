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
      <Stack.Screen name="banners/index" options={{ title: 'Banners' }} />
      <Stack.Screen name="banners/novo" options={{ title: 'Novo banner' }} />
      <Stack.Screen name="banners/[id]" options={{ title: 'Editar banner' }} />
      <Stack.Screen name="eventos/index" options={{ title: 'Eventos' }} />
      <Stack.Screen name="eventos/novo" options={{ title: 'Novo evento' }} />
      <Stack.Screen name="eventos/[id]/index" options={{ title: 'Evento' }} />
      <Stack.Screen name="eventos/[id]/editar" options={{ title: 'Editar evento' }} />
      <Stack.Screen name="eventos/[id]/resultado" options={{ title: 'Resultado' }} />
      <Stack.Screen name="eventos/[id]/presenca" options={{ title: 'Presença' }} />
      <Stack.Screen name="modalidades/index" options={{ title: 'Modalidades' }} />
      <Stack.Screen name="modalidades/nova" options={{ title: 'Nova modalidade' }} />
      <Stack.Screen name="modalidades/[id]" options={{ title: 'Editar modalidade' }} />
      <Stack.Screen name="noticias/index" options={{ title: 'Notícias' }} />
      <Stack.Screen name="noticias/nova" options={{ title: 'Nova notícia' }} />
      <Stack.Screen name="noticias/[id]/index" options={{ title: 'Editar notícia' }} />
      <Stack.Screen name="solicitacoes/index" options={{ title: 'Solicitações' }} />
      <Stack.Screen name="times/index" options={{ title: 'Times' }} />
      <Stack.Screen name="times/novo" options={{ title: 'Novo time' }} />
      <Stack.Screen name="times/[id]/editar" options={{ title: 'Editar time' }} />
      <Stack.Screen name="times/[id]/elenco" options={{ title: 'Elenco' }} />
      <Stack.Screen name="times/adversarias" options={{ title: 'Atléticas adversárias' }} />
      <Stack.Screen name="usuarios/index" options={{ title: 'Usuários' }} />
      <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuário' }} />
    </Stack>
  )
}
