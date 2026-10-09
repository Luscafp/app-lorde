import { formatarData, type NoticiaDetalheDto, type TagResumoDto } from '@atletica/shared'
import { ScrollView, View } from 'react-native'
import { ConteudoMarkdown } from '@/components/markdown'
import { Texto } from '@/components/ui'
import { ListaTags } from '../tags'
import { CapaNoticia } from './capa-noticia'

type Props = {
  /** Na prévia do Painel (#81) o rascunho ainda não tem `publicadaEm`. */
  noticia: Pick<NoticiaDetalheDto, 'titulo' | 'conteudo' | 'imagemCapaUrl' | 'tags'> & {
    publicadaEm: string | null
  }
  aoAbrirTag?: (tag: TagResumoDto) => void
}

export function NoticiaDetalhe({ noticia, aoAbrirTag }: Props) {
  return (
    <ScrollView contentContainerClassName="pb-8">
      <CapaNoticia uri={noticia.imagemCapaUrl} />
      <View className="gap-2 p-4">
        <Texto variante="titulo">{noticia.titulo}</Texto>
        {noticia.publicadaEm && (
          <Texto variante="legenda">{formatarData(noticia.publicadaEm)}</Texto>
        )}
        <ListaTags tags={noticia.tags} aoPressionar={aoAbrirTag} />
        <View className="mt-2">
          <ConteudoMarkdown conteudo={noticia.conteudo} />
        </View>
      </View>
    </ScrollView>
  )
}
