import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { Texto } from '@/components/ui'
import { useOnline } from '@/infra/rede/online'

export function TelaRecuperacao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const online = useOnline()

  return (
    <View className="flex-1 bg-fundo">
      {!online && <FaixaOffline />}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center gap-4 p-4"
      >
        <Texto variante="titulo">{titulo}</Texto>
        {children}
      </ScrollView>
    </View>
  )
}
