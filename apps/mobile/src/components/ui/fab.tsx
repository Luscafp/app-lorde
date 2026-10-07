import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'
import { corTextoSobre, useAtletica } from '@/features/atletica'

type Props = {
  rotulo: string
  icone?: ComponentProps<typeof Ionicons>['name']
  onPress: () => void
}

/** Ação principal da tela, flutuando no canto inferior direito. */
export function Fab({ rotulo, icone = 'add', onPress }: Props) {
  const { corPrimaria } = useAtletica()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg"
      style={{ backgroundColor: corPrimaria }}
    >
      <Ionicons name={icone} size={28} color={corTextoSobre(corPrimaria)} />
    </Pressable>
  )
}
