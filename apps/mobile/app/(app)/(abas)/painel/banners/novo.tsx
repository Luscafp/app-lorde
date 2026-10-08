import { router } from 'expo-router'
import { View } from 'react-native'
import { FormBanner } from '@/features/banners'

export default function NovoBanner() {
  return (
    <View className="flex-1 bg-fundo">
      <FormBanner aoConcluir={() => router.back()} />
    </View>
  )
}
