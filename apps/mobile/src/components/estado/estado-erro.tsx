import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { View } from 'react-native'
import { Botao, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

type Props = {
  mensagem?: string
  icone?: ComponentProps<typeof Ionicons>['name']
  tituloBotao?: string
  onTentarNovamente: () => void
}

export function EstadoErro({
  mensagem = 'Não foi possível carregar.',
  icone = 'alert-circle-outline',
  tituloBotao = 'Tentar novamente',
  onTentarNovamente,
}: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Ionicons name={icone} size={40} color={paleta.erro} />
      <Texto className="text-center" accessibilityLiveRegion="polite">
        {mensagem}
      </Texto>
      <Botao titulo={tituloBotao} variante="secundaria" onPress={onTentarNovamente} />
    </View>
  )
}
