import Ionicons from '@expo/vector-icons/Ionicons'
import * as Updates from 'expo-updates'
import { View } from 'react-native'
import { Botao, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

export function TelaErroFatal() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-fundo p-6">
      <Ionicons name="warning-outline" size={40} color={paleta.erro} />
      <Texto className="text-center" accessibilityLiveRegion="assertive">
        Algo deu errado. Tente reabrir o aplicativo.
      </Texto>
      <Botao titulo="Recarregar" onPress={() => void Updates.reloadAsync()} />
    </View>
  )
}
