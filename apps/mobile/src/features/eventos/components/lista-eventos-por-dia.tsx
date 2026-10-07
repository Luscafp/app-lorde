import Ionicons from '@expo/vector-icons/Ionicons'
import type { EventoResumoDto } from '@atletica/shared'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { ListaInfinita, type ConsultaInfinita } from '@/components/estado'
import { paleta } from '@/features/atletica'
import { linhasPorDia } from '../agenda'
import { CabecalhoDia } from './cabecalho-dia'
import { EventoCard } from './evento-card'

type Props = {
  testID: string
  consulta: ConsultaInfinita
  eventos: EventoResumoDto[]
  contentContainerClassName: string
  aoAbrir: (evento: EventoResumoDto) => void
  selos?: (evento: EventoResumoDto) => ReactNode
  abaixoDaSeta?: (evento: EventoResumoDto) => ReactNode
}

export function ListaEventosPorDia({ eventos, aoAbrir, selos, abaixoDaSeta, ...props }: Props) {
  return (
    <ListaInfinita
      {...props}
      data={linhasPorDia(eventos)}
      keyExtractor={(linha) => linha.dia ?? linha.evento.id}
      renderItem={({ item }) =>
        item.dia !== undefined ? (
          <CabecalhoDia dia={item.dia} />
        ) : (
          <EventoCard
            evento={item.evento}
            aoAbrir={aoAbrir}
            selos={selos?.(item.evento)}
            direita={
              <View className="items-end gap-1.5">
                <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
                {abaixoDaSeta?.(item.evento)}
              </View>
            }
          />
        )
      }
    />
  )
}
