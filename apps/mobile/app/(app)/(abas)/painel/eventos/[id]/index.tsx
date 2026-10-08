import { ehEstaESeguintes } from '@atletica/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { DetalheEventoPainel, useEventoPainel } from '@/features/eventos'

export default function EventoPainel() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useEventoPainel(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(evento) => (
          <DetalheEventoPainel
            evento={evento}
            aoEditar={(escopo) =>
              router.push(
                ehEstaESeguintes(escopo)
                  ? `/painel/eventos/${id}/editar?escopo=${escopo}`
                  : `/painel/eventos/${id}/editar`,
              )
            }
            aoExcluir={() => router.back()}
            aoRegistrarResultado={() => router.push(`/painel/eventos/${id}/resultado`)}
          />
        )}
      </TelaDados>
    </View>
  )
}
