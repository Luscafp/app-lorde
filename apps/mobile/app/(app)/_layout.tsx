import { Stack } from 'expo-router'

export const unstable_settings = { initialRouteName: '(abas)' }

/** Abas e, acima delas, as telas de detalhe (eventos, notícias...). */
export default function LayoutApp() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(abas)" />
    </Stack>
  )
}
