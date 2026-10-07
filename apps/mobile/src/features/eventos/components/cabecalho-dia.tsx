import type { Instante } from '@atletica/shared'
import { View } from 'react-native'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { rotuloDia } from '../formatacao'

export function CabecalhoDia({ dia, agora }: { dia: string; agora?: Instante }) {
  const { corPrimaria } = useAtletica()
  return (
    <View className="flex-row items-center gap-2 pt-2">
      <Texto
        accessibilityRole="header"
        className="text-sm font-semibold"
        style={{ color: corPrimaria }}
      >
        {rotuloDia(dia, agora)}
      </Texto>
      <View className="h-px flex-1 bg-borda" />
    </View>
  )
}
