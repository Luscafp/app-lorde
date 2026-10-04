import type { ComponentProps } from 'react'
import type { FieldValues } from 'react-hook-form'
import { Campo } from '@/components/ui'

type Props<T extends FieldValues> = Omit<ComponentProps<typeof Campo<T>>, 'rotulo'>

export function CampoEmail<T extends FieldValues>(props: Props<T>) {
  return (
    <Campo
      rotulo="E-mail"
      placeholder="seu@email.com"
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      autoCorrect={false}
      {...props}
    />
  )
}
