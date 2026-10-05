import { ActivityIndicator, FlatList, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { paleta } from '@/features/atletica'
import { NoticiaCard } from './components'
import { useNoticias } from './consultas'

export const MENSAGEM_SEM_NOTICIAS = 'Nenhuma notícia publicada'

export function ListaNoticias({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const consulta = useNoticias()
  const carregarMais = () => {
    if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage()
  }

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados
        consulta={consulta}
        esqueleto="cartao"
        vazio={(noticias) => noticias.length === 0}
        mensagemVazio={MENSAGEM_SEM_NOTICIAS}
      >
        {(noticias) => (
          <FlatList
            testID="lista-noticias"
            data={noticias}
            keyExtractor={({ id }) => id}
            renderItem={({ item }) => <NoticiaCard noticia={item} aoAbrir={aoAbrir} />}
            contentContainerClassName="gap-4 p-4"
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
        )}
      </TelaDados>
    </View>
  )
}
