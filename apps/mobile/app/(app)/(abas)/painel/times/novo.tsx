import { router } from 'expo-router'
import { View } from 'react-native'
import { FormTime } from '@/features/times'

export default function NovoTime() {
  return (
    <View className="flex-1 bg-fundo">
      <FormTime aoSalvar={() => router.back()} />
    </View>
  )
}
