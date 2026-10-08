import { StatusEvento, TipoEvento } from '@atletica/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { ResultadoForm, useEventoPainel } from '@/features/eventos'

export default function ResultadoEvento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useEventoPainel(id)
  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(evento) => {
          if (evento.tipo !== TipoEvento.JOGO)
            return <EstadoVazio mensagem="Treinos não têm placar." />
          if (evento.status === StatusEvento.CANCELADO)
            return <EstadoVazio mensagem="Jogo cancelado não recebe placar." />
          return <ResultadoForm evento={evento} aoSalvar={() => router.back()} />
        }}
      </TelaDados>
    </View>
  )
}
