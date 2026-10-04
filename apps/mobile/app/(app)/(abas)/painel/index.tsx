import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

// Até a tela de times (#65), "Times e modalidades" abre direto a lista de modalidades.
const ITENS = [{ titulo: 'Times e modalidades', rota: '/painel/modalidades' }] as const

export default function Painel() {
  return (
    <View className="flex-1 gap-2 bg-fundo p-4">
      <Texto variante="titulo" className="mb-2">
        Painel
      </Texto>
      {ITENS.map(({ titulo, rota }) => (
        <Pressable
          key={rota}
          accessibilityRole="button"
          accessibilityLabel={titulo}
          onPress={() => router.push(rota)}
          className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-borda bg-cartao px-4 py-3"
        >
          <Texto>{titulo}</Texto>
          <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
        </Pressable>
      ))}
    </View>
  )
}
