import { RefreshControl, ScrollView, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { ehNaoEncontrado } from '@/infra/api/api-erro'
import { EventoDetalhe } from './components'
import { useEvento } from './consultas'

export const MENSAGEM_EVENTO_NAO_ENCONTRADO = 'Evento não encontrado'

/** O 404 vence o cache: o evento pode ter sido excluído depois de carregado. */
type Props = { id: string; aoGerenciar: () => void; aoAbrirTime: (timeId: string) => void }

export function TelaEvento({ id, aoGerenciar, aoAbrirTime }: Props) {
  const consulta = useEvento(id)

  return (
    <View className="flex-1 bg-fundo">
      {ehNaoEncontrado(consulta.error) ? (
        <EstadoVazio mensagem={MENSAGEM_EVENTO_NAO_ENCONTRADO} />
      ) : (
        <TelaDados consulta={consulta} esqueleto="detalhe">
          {(evento) => (
            <ScrollView
              testID="detalhe-evento"
              contentContainerClassName="p-4 pb-8"
              refreshControl={
                <RefreshControl
                  refreshing={consulta.isRefetching && !consulta.isPlaceholderData}
                  onRefresh={() => void consulta.refetch()}
                />
              }
            >
              <EventoDetalhe
                evento={evento}
                aoGerenciar={aoGerenciar}
                aoAbrirTime={aoAbrirTime}
                aoTentarNovamente={consulta.refetch}
              />
            </ScrollView>
          )}
        </TelaDados>
      )}
    </View>
  )
}
