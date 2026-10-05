import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { FormTime, useTime } from '@/features/times'

export default function EditarTime() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useTime(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(time) => <FormTime time={time} aoSalvar={() => router.back()} />}
      </TelaDados>
    </View>
  )
}
