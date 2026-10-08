import { Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'

type Props = { titulo: string; acao: { titulo: string; onPress: () => void } }

export function CabecalhoSecao({ titulo, acao }: Props) {
  const { corPrimaria } = useAtletica()
  return (
    <View className="flex-row items-center justify-between">
      <Texto variante="subtitulo">{titulo}</Texto>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={acao.titulo}
        onPress={acao.onPress}
        className="min-h-[44px] justify-center px-1"
      >
        <Texto variante="rotulo" style={{ color: corPrimaria }}>
          {acao.titulo}
        </Texto>
      </Pressable>
    </View>
  )
}
