import Ionicons from '@expo/vector-icons/Ionicons'
import { useState, type ComponentProps } from 'react'
import type { FieldValues } from 'react-hook-form'
import { Pressable } from 'react-native'
import { paleta } from '@/features/atletica'
import { Campo } from './campo'

type Props<T extends FieldValues> = Omit<ComponentProps<typeof Campo<T>>, 'acessorio'>

export function CampoSenha<T extends FieldValues>(props: Props<T>) {
  const [visivel, setVisivel] = useState(false)

  return (
    <Campo
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!visivel}
      acessorio={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={props.editable === false}
          onPress={() => setVisivel((atual) => !atual)}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Ionicons
            name={visivel ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={paleta['texto-suave']}
          />
        </Pressable>
      }
    />
  )
}
