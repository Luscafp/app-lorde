import { Text, View } from 'react-native'
import { paleta } from '@/features/atletica'

export function Selo({ texto, cor = paleta['texto-suave'] }: { texto: string; cor?: string }) {
  return (
    <View className="rounded-full border px-2 py-0.5" style={{ borderColor: cor }}>
      <Text className="text-xs font-semibold" style={{ color: cor }}>
        {texto}
      </Text>
    </View>
  )
}
