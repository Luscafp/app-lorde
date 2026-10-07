import { router } from 'expo-router'
import { View } from 'react-native'
import { FormNoticia } from '@/features/noticias'

export default function NovaNoticia() {
  return (
    <View className="flex-1 bg-fundo">
      <FormNoticia aoConcluir={() => router.back()} />
    </View>
  )
}
