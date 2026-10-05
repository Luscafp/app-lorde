import { formatarData, type NoticiaDetalheDto } from '@atletica/shared'
import { ScrollView, View } from 'react-native'
import { ConteudoMarkdown } from '@/components/markdown'
import { Texto } from '@/components/ui'
import { CapaNoticia } from './capa-noticia'

type Props = {
  /** Na prévia do Painel (#81) o rascunho ainda não tem `publicadaEm`. */
  noticia: Pick<NoticiaDetalheDto, 'titulo' | 'conteudo' | 'imagemCapaUrl'> & {
    publicadaEm: string | null
  }
}

export function NoticiaDetalhe({ noticia }: Props) {
  return (
    <ScrollView contentContainerClassName="pb-8">
      <CapaNoticia uri={noticia.imagemCapaUrl} />
      <View className="gap-2 p-4">
        <Texto variante="titulo">{noticia.titulo}</Texto>
        {noticia.publicadaEm && (
          <Texto variante="legenda">{formatarData(noticia.publicadaEm)}</Texto>
        )}
        <View className="mt-2">
          <ConteudoMarkdown conteudo={noticia.conteudo} />
        </View>
      </View>
    </ScrollView>
  )
}
