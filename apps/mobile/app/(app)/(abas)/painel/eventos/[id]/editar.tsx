import { StatusEvento } from '@atletica/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { EventoForm, useEventoPainel } from '@/features/eventos'

export default function EditarEvento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useEventoPainel(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(evento) =>
          evento.status === StatusEvento.CANCELADO ? (
            <EstadoVazio mensagem="Evento cancelado não pode ser editado." />
          ) : (
            <EventoForm evento={evento} aoSalvar={() => router.back()} />
          )
        }
      </TelaDados>
    </View>
  )
}
