import Ionicons from '@expo/vector-icons/Ionicons'
import type { TimeDto } from '@atletica/shared'
import { Pressable, View } from 'react-native'
import { Cartao, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { resumoElenco } from './formatacao'

export function CartaoTime({ time, aoAbrir }: { time: TimeDto; aoAbrir: (id: string) => void }) {
  const resumo = resumoElenco(time)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${time.nome}, ${resumo}`}
      onPress={() => aoAbrir(time.id)}
    >
      <Cartao className="min-h-[44px] flex-row items-center gap-3">
        <View className="flex-1 gap-1">
          <Texto className="font-semibold">{time.nome}</Texto>
          <Texto variante="legenda">{resumo}</Texto>
        </View>
        <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
      </Cartao>
    </Pressable>
  )
}
