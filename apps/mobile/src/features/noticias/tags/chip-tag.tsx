import { Pressable, Text, View } from 'react-native'
import { comAlfa, useAtletica } from '@/features/atletica'

type Props = {
  nome: string
  aoPressionar?: () => void
}

/** Sem `aoPressionar`, só exibe (ex.: dentro do card, que já é tocável). */
export function ChipTag({ nome, aoPressionar }: Props) {
  const { corPrimaria } = useAtletica()
  const estilo = { backgroundColor: comAlfa(corPrimaria) }
  const texto = (
    <Text className="text-xs font-semibold" style={{ color: corPrimaria }} numberOfLines={1}>
      {nome}
    </Text>
  )
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
