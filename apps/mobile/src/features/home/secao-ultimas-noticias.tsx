import type { NoticiaResumoDto } from '@atletica/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { MENSAGEM_SEM_NOTICIAS, NoticiaCard } from '@/features/noticias'
import { CabecalhoSecao } from './cabecalho-secao'

export const MENSAGEM_ERRO_NOTICIAS = 'Não foi possível carregar as notícias'

type Props = {
  consulta: UseQueryResult<NoticiaResumoDto[]>
  aoVerTodas: () => void
  aoAbrirNoticia: (id: string) => void
}

export function SecaoUltimasNoticias({ consulta, aoVerTodas, aoAbrirNoticia }: Props) {
  return (
    <View testID="secao-ultimas-noticias" className="gap-2">
      <CabecalhoSecao
        titulo="Últimas notícias"
        acao={{ titulo: 'Ver todas', onPress: aoVerTodas }}
      />
      <TelaDados
        consulta={consulta}
        esqueleto="cartao"
        faixaOffline={false}
        vazio={(noticias) => noticias.length === 0}
        mensagemVazio={MENSAGEM_SEM_NOTICIAS}
        mensagemErro={MENSAGEM_ERRO_NOTICIAS}
      >
        {(noticias) => (
          <View className="gap-4">
            {noticias.map((noticia) => (
              <NoticiaCard key={noticia.id} noticia={noticia} aoAbrir={aoAbrirNoticia} />
            ))}
          </View>
        )}
      </TelaDados>
    </View>
  )
}
