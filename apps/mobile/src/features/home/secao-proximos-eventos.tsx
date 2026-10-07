import Ionicons from '@expo/vector-icons/Ionicons'
import type { ListaEventos } from '@atletica/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { paleta } from '@/features/atletica'
import { EventoCard, MENSAGEM_SEM_EVENTOS, MinhaRespostaChip } from '@/features/eventos'
import { CabecalhoSecao } from './cabecalho-secao'

const MENSAGEM_ERRO_EVENTOS = 'Não foi possível carregar os eventos'

type Props = {
  consulta: UseQueryResult<ListaEventos>
  aoVerAgenda: () => void
  aoAbrirEvento: (id: string) => void
}

export function SecaoProximosEventos({ consulta, aoVerAgenda, aoAbrirEvento }: Props) {
  return (
    <View testID="secao-proximos-eventos" className="gap-2">
      <CabecalhoSecao
        titulo="Próximos eventos"
        acao={{ titulo: 'Ver agenda', onPress: aoVerAgenda }}
      />
      <TelaDados
        consulta={consulta}
        esqueleto={{ variante: 'cartoes', quantidade: 3 }}
        faixaOffline={false}
        vazio={({ items }) => items.length === 0}
        mensagemVazio={MENSAGEM_SEM_EVENTOS}
        mensagemErro={MENSAGEM_ERRO_EVENTOS}
      >
        {({ items }) => (
          <View className="gap-2">
            {items.map((evento) => (
              <EventoCard
                key={evento.id}
                evento={evento}
                aoAbrir={({ id }) => aoAbrirEvento(id)}
                direita={
                  <View className="items-end gap-1.5">
                    <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
                    <MinhaRespostaChip evento={evento} />
                  </View>
                }
              />
            ))}
          </View>
        )}
      </TelaDados>
    </View>
  )
}
