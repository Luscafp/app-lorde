import Ionicons from '@expo/vector-icons/Ionicons'
import { View } from 'react-native'
import { Botao, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

type Props = {
  mensagem: string
  acao?: { titulo: string; onPress: () => void }
}

export function EstadoVazio({ mensagem, acao }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Ionicons name="file-tray-outline" size={40} color={paleta['texto-suave']} />
      <Texto variante="legenda" className="text-center">
        {mensagem}
      </Texto>
      {acao && <Botao titulo={acao.titulo} variante="secundaria" onPress={acao.onPress} />}
    </View>
  )
}
