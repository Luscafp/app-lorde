import { formatarDataHora, StatusNoticia, type NoticiaPainelDto } from '@atletica/shared'
import { Pressable, View } from 'react-native'
import { Imagem } from '@/components/imagem'
import { Selo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

const COR_STATUS: Record<StatusNoticia, string> = {
  PUBLICADA: paleta.sucesso,
  RASCUNHO: paleta.alerta,
}

function dataDaNoticia({ status, publicadaEm, atualizadoEm }: NoticiaPainelDto): string {
  if (status === StatusNoticia.PUBLICADA && publicadaEm) {
    return `Publicada em ${formatarDataHora(publicadaEm)}`
  }
  return `Editada em ${formatarDataHora(atualizadoEm)}`
}

type Props = {
  noticia: NoticiaPainelDto
  aoAbrir: (id: string) => void
}

export function ItemNoticiaPainel({ noticia, aoAbrir }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${noticia.titulo}, ${noticia.status}`}
      onPress={() => aoAbrir(noticia.id)}
      className="min-h-[44px] flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao p-3 active:opacity-80"
    >
      <Imagem uri={noticia.imagemCapaUrl} className="aspect-video w-24 rounded-lg" />
      <View className="flex-1 gap-1">
        <Texto className="font-semibold" numberOfLines={2}>
          {noticia.titulo}
        </Texto>
        <View className="flex-row">
          <Selo texto={noticia.status} cor={COR_STATUS[noticia.status]} />
        </View>
        <Texto variante="legenda">{dataDaNoticia(noticia)}</Texto>
        <Texto variante="legenda">{`Por ${noticia.autor.nome}`}</Texto>
      </View>
    </Pressable>
  )
}
