import { EscopoOcorrencia, StatusEvento } from '@atletica/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { EventoForm, useEventoPainel } from '@/features/eventos'

export default function EditarEvento() {
  const { id, escopo } = useLocalSearchParams<{ id: string; escopo?: string }>()
  const consulta = useEventoPainel(id)
  const seguintes = escopo === EscopoOcorrencia.ESTA_E_SEGUINTES

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(evento) =>
          evento.status === StatusEvento.CANCELADO ? (
            <EstadoVazio mensagem="Evento cancelado não pode ser editado." />
          ) : (
            <EventoForm
              evento={evento}
              escopo={seguintes ? EscopoOcorrencia.ESTA_E_SEGUINTES : undefined}
              aoSalvar={() => router.back()}
            />
          )
        }
      </TelaDados>
    </View>
  )
}
