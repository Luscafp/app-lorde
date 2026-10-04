import { router } from 'expo-router'
import { View } from 'react-native'
import { FormModalidade } from '@/features/modalidades'

export default function NovaModalidade() {
  return (
    <View className="flex-1 bg-fundo">
      <FormModalidade aoSalvar={() => router.back()} />
    </View>
  )
}
