import type { ReactNode } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { TextInput, View, type TextInputProps } from 'react-native'
import { paleta } from '@/features/atletica'
import { Texto } from './texto'

type Props<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  controle: Control<T>
  nome: Path<T>
  rotulo: string
  /** Fica à direita, dentro do campo (ex.: mostrar senha). */
  acessorio?: ReactNode
}

/** Campo de texto ligado ao React Hook Form; o erro do Zod aparece abaixo do campo. */
export function Campo<T extends FieldValues>({
  controle,
  nome,
  rotulo,
  acessorio,
  ...entrada
}: Props<T>) {
  return (
    <Controller
      control={controle}
      name={nome}
      render={({ field, fieldState: { error } }) => (
        <View className="gap-1">
          <Texto variante="rotulo">{rotulo}</Texto>
          <View className="justify-center">
            <TextInput
              ref={field.ref}
              value={field.value == null ? '' : String(field.value)}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              accessibilityLabel={rotulo}
              accessibilityHint={error?.message}
              placeholderTextColor={paleta['texto-suave']}
              className={`min-h-[44px] rounded-xl border bg-superficie px-3 py-2 text-base text-texto ${
                error ? 'border-erro' : 'border-borda'
              } ${acessorio ? 'pr-12' : ''} ${entrada.editable === false ? 'opacity-50' : ''}`}
              {...entrada}
            />
            {acessorio && <View className="absolute right-0">{acessorio}</View>}
          </View>
          {error?.message && (
            <Texto variante="erro" accessibilityLiveRegion="polite">
              {error.message}
            </Texto>
          )}
        </View>
      )}
    />
  )
}
