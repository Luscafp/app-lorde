import { View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { ehNaoEncontrado } from '@/infra/api/api-erro'
import { NoticiaDetalhe } from './components'
import { useNoticia } from './consultas'

export const MENSAGEM_INDISPONIVEL = 'Esta notícia não está mais disponível'

/** O 404 vence o cache: a notícia pode ter sido despublicada depois de carregada. */
export function TelaNoticia({ id }: { id: string }) {
  const consulta = useNoticia(id)

  return (
    <View className="flex-1 bg-fundo">
      {ehNaoEncontrado(consulta.error) ? (
        <EstadoVazio mensagem={MENSAGEM_INDISPONIVEL} />
      ) : (
        <TelaDados consulta={consulta} esqueleto="detalhe">
          {(noticia) => <NoticiaDetalhe noticia={noticia} />}
        </TelaDados>
      )}
    </View>
  )
}
