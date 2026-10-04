import Ionicons from '@expo/vector-icons/Ionicons'
import { Image, View } from 'react-native'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'

export function CabecalhoAuth({ subtitulo }: { subtitulo: string }) {
  const { nome, logoUrl, corPrimaria } = useAtletica()

  return (
    <View className="items-center gap-2 pb-4">
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          accessibilityIgnoresInvertColors
          accessible={false}
          className="h-20 w-20 rounded-2xl"
        />
      ) : (
        <Ionicons name="shield" size={48} color={corPrimaria} />
      )}
      <Texto variante="titulo" className="text-center">
        {nome}
      </Texto>
      <Texto variante="legenda" className="text-center">
        {subtitulo}
      </Texto>
    </View>
  )
}
