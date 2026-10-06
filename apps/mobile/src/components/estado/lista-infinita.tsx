import { ActivityIndicator, FlatList, type FlatListProps } from 'react-native'
import { paleta } from '@/features/atletica'

type ConsultaInfinita = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isRefetching: boolean
  fetchNextPage: () => Promise<unknown>
  refetch: () => Promise<unknown>
}

type Props<T> = Omit<
  FlatListProps<T>,
  'onEndReached' | 'onEndReachedThreshold' | 'refreshing' | 'onRefresh' | 'ListFooterComponent'
> & { consulta: ConsultaInfinita }

/** `FlatList` de uma infinite query: carrega mais no fim e recarrega ao puxar. */
export function ListaInfinita<T>({ consulta, ...props }: Props<T>) {
  const carregarMais = () => {
    if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage()
  }

  return (
    <FlatList
      {...props}
      onEndReached={carregarMais}
      onEndReachedThreshold={0.5}
      refreshing={consulta.isRefetching && !consulta.isFetchingNextPage}
      onRefresh={() => void consulta.refetch()}
      ListFooterComponent={
        consulta.isFetchingNextPage ? (
          <ActivityIndicator className="py-4" color={paleta['texto-suave']} />
        ) : null
      }
    />
  )
}
