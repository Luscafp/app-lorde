import Ionicons from '@expo/vector-icons/Ionicons'
import { StyleSheet, View } from 'react-native'
import { Imagem } from '@/components/imagem'
import { corTextoSobre, useAtletica } from '@/features/atletica'

/** Capa ausente (dado legado) ou com erro: cores da atlética, sem quebrar o 16:9. */
function CapaPlaceholder() {
  const { corPrimaria } = useAtletica()
  return (
    <View
      testID="capa-placeholder"
      style={[StyleSheet.absoluteFill, { backgroundColor: corPrimaria }]}
      className="items-center justify-center"
    >
      <Ionicons name="newspaper-outline" size={40} color={corTextoSobre(corPrimaria)} />
    </View>
  )
}

export function CapaNoticia({ uri, className }: { uri: string | null; className?: string }) {
  return (
    <Imagem
      uri={uri}
      className={`aspect-video w-full ${className ?? ''}`}
      fallback={<CapaPlaceholder />}
    />
  )
}
