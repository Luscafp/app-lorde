import { formatarData, type NoticiaResumoDto } from '@atletica/shared'
import { Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { ListaTags } from '../tags'
import { CapaNoticia } from './capa-noticia'

const TAGS_NO_CARD = 3

type Props = {
  noticia: Pick<NoticiaResumoDto, 'id' | 'titulo' | 'imagemCapaUrl' | 'publicadaEm' | 'tags'>
  aoAbrir: (id: string) => void
}

export function NoticiaCard({ noticia, aoAbrir }: Props) {
  const data = formatarData(noticia.publicadaEm)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${noticia.titulo}, ${data}`}
      onPress={() => aoAbrir(noticia.id)}
      className="overflow-hidden rounded-2xl border border-borda bg-cartao active:opacity-80"
    >
      <CapaNoticia uri={noticia.imagemCapaUrl} />
      <View className="gap-1 p-4">
        <Texto variante="subtitulo" numberOfLines={2}>
          {noticia.titulo}
        </Texto>
        <Texto variante="legenda">{data}</Texto>
        <ListaTags tags={noticia.tags} maximo={TAGS_NO_CARD} />
      </View>
    </Pressable>
  )
}
