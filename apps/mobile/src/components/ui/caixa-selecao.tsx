import Ionicons from '@expo/vector-icons/Ionicons'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { corTextoSobre, paleta, useAtletica } from '@/features/atletica'

type Props = {
  marcada: boolean
  aoAlternar: (marcada: boolean) => void
  /** Nome acessível da caixa; o texto visível (com links) vem em `children`. */
  rotulo: string
  children: ReactNode
}

export function CaixaSelecao({ marcada, aoAlternar, rotulo, children }: Props) {
  const { corPrimaria } = useAtletica()

  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={rotulo}
        accessibilityState={{ checked: marcada }}
        onPress={() => aoAlternar(!marcada)}
        className="min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <View
          className="h-6 w-6 items-center justify-center rounded-md border-2"
          style={{
            borderColor: marcada ? corPrimaria : paleta.borda,
            backgroundColor: marcada ? corPrimaria : 'transparent',
          }}
        >
          {marcada && <Ionicons name="checkmark" size={16} color={corTextoSobre(corPrimaria)} />}
        </View>
      </Pressable>
      <View className="flex-1">{children}</View>
    </View>
  )
}
