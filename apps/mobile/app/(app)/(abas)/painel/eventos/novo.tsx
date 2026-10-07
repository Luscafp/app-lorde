import { router } from 'expo-router'
import { View } from 'react-native'
import { EventoForm } from '@/features/eventos'

export default function NovoEvento() {
  return (
    <View className="flex-1 bg-fundo">
      <EventoForm aoSalvar={({ id }) => router.replace(`/painel/eventos/${id}`)} />
    </View>
  )
}
