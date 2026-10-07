import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { DetalheEventoPainel, useEvento } from '@/features/eventos'

export default function EventoPainel() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useEvento(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(evento) => (
          <DetalheEventoPainel
            evento={evento}
            aoEditar={() => router.push(`/painel/eventos/${id}/editar`)}
            aoExcluir={() => router.back()}
          />
        )}
      </TelaDados>
    </View>
  )
}
