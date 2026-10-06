import { TextInput } from 'react-native'
import { paleta } from '@/features/atletica'

type Props = {
  rotulo: string
  valor: string
  aoMudar: (termo: string) => void
}

export function CampoBusca({ rotulo, valor, aoMudar }: Props) {
  return (
    <TextInput
      value={valor}
      onChangeText={aoMudar}
      accessibilityLabel={rotulo}
      placeholder={rotulo}
      placeholderTextColor={paleta['texto-suave']}
      autoCorrect={false}
      returnKeyType="search"
      className="min-h-[44px] rounded-xl border border-borda bg-superficie px-3 py-2 text-base text-texto"
    />
  )
}
