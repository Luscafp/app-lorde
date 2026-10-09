import type { TagResumoDto } from '@atletica/shared'
import { ActivityIndicator, FlatList, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { paleta } from '@/features/atletica'
import { NoticiaCard } from './components'
import { useNoticias } from './consultas'
import { FiltroTags, useTags } from './tags'

export const MENSAGEM_SEM_NOTICIAS = 'Nenhuma notícia publicada'

export const mensagemSemNoticiasDaTag = (nome?: string) =>
  nome ? `Nenhuma notícia com a tag ${nome}` : 'Nenhuma notícia com esta tag'

/** `nome` vem da rota: a tag pode ter saído das tags em uso (UC05 A1). */
export type FiltroTag = { id: string; nome?: string }

type Props = {
  filtro?: FiltroTag
  aoAbrir: (id: string) => void
  /** Sem ele, a lista não mostra o filtro. */
  aoFiltrar?: (tag: TagResumoDto | undefined) => void
}

export function ListaNoticias({ filtro, aoAbrir, aoFiltrar }: Props) {
  const consulta = useNoticias({ tagId: filtro?.id })
  const { data: tags } = useTags({ emUso: true }, { enabled: !!filtro })
  const nomeDaTag = filtro?.nome ?? tags?.find(({ id }) => id === filtro?.id)?.nome
  const carregarMais = () => {
    if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage()
  }

  return (
    <View className="flex-1 bg-fundo">
      {aoFiltrar && (
        <View className="px-4 pt-4">
          <FiltroTags tagId={filtro?.id} aoMudar={aoFiltrar} />
        </View>
      )}
      <TelaDados
        consulta={consulta}
        esqueleto="cartao"
        vazio={(noticias) => noticias.length === 0}
        mensagemVazio={filtro ? mensagemSemNoticiasDaTag(nomeDaTag) : MENSAGEM_SEM_NOTICIAS}
        acaoVazio={
          filtro && aoFiltrar && { titulo: 'Limpar filtro', onPress: () => aoFiltrar(undefined) }
        }
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
