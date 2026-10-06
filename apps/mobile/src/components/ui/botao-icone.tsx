import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'
import { paleta } from '@/features/atletica'

type Props = {
  icone: ComponentProps<typeof Ionicons>['name']
  rotulo: string
  cor?: string
  disabled?: boolean
  onPress: () => void
}

export function BotaoIcone({ icone, rotulo, cor = paleta.texto, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!props.disabled }}
      className="h-11 w-11 items-center justify-center"
      style={{ opacity: props.disabled ? 0.5 : 1 }}
      {...props}
    >
      <Ionicons name={icone} size={22} color={cor} />
    </Pressable>
  )
}
