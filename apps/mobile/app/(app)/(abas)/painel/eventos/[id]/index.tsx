import { EscopoOcorrencia } from '@atletica/shared'
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
                escopo === EscopoOcorrencia.ESTA_E_SEGUINTES
                  ? `/painel/eventos/${id}/editar?escopo=${escopo}`
                  : `/painel/eventos/${id}/editar`,
              )
            }
            aoExcluir={() => router.back()}
          />
        )}
      </TelaDados>
    </View>
  )
}
