import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { paleta } from '@/features/atletica'

/** Tela de formulário ou texto longo: rola e respeita as áreas seguras. */
export function TelaRolavel({
  centralizada = false,
  children,
}: {
  centralizada?: boolean
  children: ReactNode
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paleta.fundo }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={`flex-grow gap-4 p-4 ${centralizada ? 'justify-center' : ''}`}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
