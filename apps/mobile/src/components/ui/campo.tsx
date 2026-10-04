import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { TextInput, View, type TextInputProps } from 'react-native'
import { paleta } from '@/features/atletica'
import { Texto } from './texto'

type Props<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  controle: Control<T>
  nome: Path<T>
  rotulo: string
}

/** Campo de texto ligado ao React Hook Form; o erro do Zod aparece abaixo do campo. */
export function Campo<T extends FieldValues>({ controle, nome, rotulo, ...entrada }: Props<T>) {
  return (
    <Controller
      control={controle}
      name={nome}
      render={({ field, fieldState: { error } }) => (
        <View className="gap-1">
          <Texto variante="rotulo">{rotulo}</Texto>
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
            }`}
            {...entrada}
          />
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
