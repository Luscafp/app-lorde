import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'

type Atalho = {
  rotulo: string
  icone: ComponentProps<typeof Ionicons>['name']
  onPress: () => void
}

type Props = {
  aoAbrirAgenda: () => void
  aoAbrirPlacar: () => void
  aoAbrirTimes: () => void
  aoAbrirNoticias: () => void
}

export function HomeAtalhos({
  aoAbrirAgenda,
  aoAbrirPlacar,
  aoAbrirTimes,
  aoAbrirNoticias,
}: Props) {
  const { corPrimaria } = useAtletica()
  const atalhos: Atalho[] = [
    { rotulo: 'Agenda', icone: 'calendar-outline', onPress: aoAbrirAgenda },
    { rotulo: 'Placar', icone: 'trophy-outline', onPress: aoAbrirPlacar },
    { rotulo: 'Times', icone: 'people-outline', onPress: aoAbrirTimes },
    { rotulo: 'Notícias', icone: 'newspaper-outline', onPress: aoAbrirNoticias },
  ]

  return (
    <View className="flex-row gap-2">
      {atalhos.map(({ rotulo, icone, onPress }) => (
        <Pressable
          key={rotulo}
          accessibilityRole="button"
          accessibilityLabel={rotulo}
          onPress={onPress}
          className="min-h-[44px] flex-1 items-center gap-1.5 rounded-2xl border border-borda bg-cartao py-3 active:opacity-80"
        >
          <Ionicons name={icone} size={22} color={corPrimaria} />
          <Texto variante="legenda">{rotulo}</Texto>
        </Pressable>
      ))}
    </View>
  )
}
