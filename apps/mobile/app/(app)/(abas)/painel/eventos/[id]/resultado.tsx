import { TipoEvento } from '@atletica/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { aceitaResultado, ResultadoForm, useEventoPainel } from '@/features/eventos'

export default function ResultadoEvento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useEventoPainel(id)
  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(evento) => {
          if (!aceitaResultado(evento)) {
            const mensagem =
              evento.tipo === TipoEvento.JOGO
                ? 'Jogo cancelado não recebe placar.'
                : 'Treinos não têm placar.'
            return <EstadoVazio mensagem={mensagem} />
          }
          return <ResultadoForm evento={evento} aoSalvar={() => router.back()} />
        }}
      </TelaDados>
    </View>
  )
}
