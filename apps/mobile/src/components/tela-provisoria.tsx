import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

/** Conteúdo provisório das rotas até as issues de tela. */
export function TelaProvisoria({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-fundo p-4">
      <Text accessibilityRole="header" className="text-2xl font-semibold text-texto">
        {titulo}
      </Text>
      {children}
    </View>
  )
}
