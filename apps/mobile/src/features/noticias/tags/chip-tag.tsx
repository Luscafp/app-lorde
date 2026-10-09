import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, Text, View } from 'react-native'
import { comAlfa, useAtletica } from '@/features/atletica'

type Props = {
  nome: string
  aoPressionar?: () => void
  aoRemover?: () => void
  desabilitado?: boolean
}

/** Sem `aoPressionar`, só exibe (ex.: dentro do card, que já é tocável). */
export function ChipTag({ nome, aoPressionar, aoRemover, desabilitado = false }: Props) {
  const { corPrimaria } = useAtletica()
  const estilo = { backgroundColor: comAlfa(corPrimaria) }
  const texto = (
    <Text className="text-xs font-semibold" style={{ color: corPrimaria }} numberOfLines={1}>
      {nome}
    </Text>
  )
  if (aoRemover) {
    return (
      <View className="min-h-[32px] flex-row items-center rounded-full pl-3" style={estilo}>
        {texto}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remover tag ${nome}`}
          disabled={desabilitado}
          onPress={aoRemover}
          hitSlop={6}
          className="h-8 w-8 items-center justify-center active:opacity-70"
        >
          <Ionicons name="close" size={16} color={corPrimaria} />
        </Pressable>
      </View>
    )
  }
  if (!aoPressionar) {
    return (
      <View className="rounded-full px-2 py-0.5" style={estilo}>
        {texto}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver notícias com a tag ${nome}`}
      onPress={aoPressionar}
      hitSlop={8}
      className="min-h-[32px] justify-center rounded-full px-3 active:opacity-70"
      style={estilo}
    >
      {texto}
    </Pressable>
  )
}
