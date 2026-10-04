import { Stack } from 'expo-router'

export const unstable_settings = { initialRouteName: 'login' }

export default function LayoutPublico() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="cadastro" />
    </Stack>
  )
}
