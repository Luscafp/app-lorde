import { Stack } from 'expo-router'
import { paleta } from '@/features/atletica'

export const unstable_settings = { initialRouteName: 'index' }

export default function LayoutTimes() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: paleta.superficie },
        headerTintColor: paleta.texto,
        contentStyle: { backgroundColor: paleta.fundo },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[timeId]" options={{ title: 'Time' }} />
    </Stack>
  )
}
