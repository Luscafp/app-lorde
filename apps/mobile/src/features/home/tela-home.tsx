import { RefreshControl, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FaixaOffline } from '@/components/estado'
import { paleta } from '@/features/atletica'
import { useProximosEventos, type AbaAgenda } from '@/features/eventos'
import { useUltimasNoticias } from '@/features/noticias'
import { combinarConsultas } from '@/infra/query/combinar-consultas'
import { useOnline } from '@/infra/rede/online'
import { useMarcarHomePronta } from '@/infra/sentry'
import { HomeAtalhos } from './home-atalhos'
import { HomeBannersSlot } from './home-banners-slot'
import { HomeHeader } from './home-header'
import { SecaoProximosEventos } from './secao-proximos-eventos'
import { SecaoUltimasNoticias } from './secao-ultimas-noticias'

type NavegacaoHome = {
  aoAbrirAgenda: (aba: AbaAgenda) => void
  aoAbrirTimes: () => void
  aoAbrirNoticias: () => void
  aoAbrirEvento: (id: string) => void
  aoAbrirNoticia: (id: string) => void
  aoAbrirPerfil: () => void
}

export function TelaHome(navegacao: NavegacaoHome) {
  const eventos = useProximosEventos()
  const noticias = useUltimasNoticias()
  const secoes = combinarConsultas([eventos, noticias])
  const online = useOnline()
  const emCache = [eventos, noticias].filter(({ data }) => data !== undefined)

  useMarcarHomePronta(!eventos.isPending && !noticias.isPending)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: paleta.fundo }}>
      {!online && emCache.length > 0 && (
        <FaixaOffline atualizadoEm={combinarConsultas(emCache).dataUpdatedAt} />
      )}
      <ScrollView
        testID="home"
        contentContainerClassName="gap-6 p-4"
        refreshControl={
          <RefreshControl
            refreshing={secoes.isRefetching}
            onRefresh={() => void secoes.refetch()}
          />
        }
      >
        <HomeHeader aoAbrirPerfil={navegacao.aoAbrirPerfil} />
        <HomeBannersSlot />
        <HomeAtalhos
          aoAbrirAgenda={() => navegacao.aoAbrirAgenda('eventos')}
          aoAbrirPlacar={() => navegacao.aoAbrirAgenda('placar')}
          aoAbrirTimes={navegacao.aoAbrirTimes}
          aoAbrirNoticias={navegacao.aoAbrirNoticias}
        />
        <SecaoProximosEventos
          consulta={eventos}
          aoVerAgenda={() => navegacao.aoAbrirAgenda('eventos')}
          aoAbrirEvento={navegacao.aoAbrirEvento}
        />
        <SecaoUltimasNoticias
          consulta={noticias}
          aoVerTodas={navegacao.aoAbrirNoticias}
          aoAbrirNoticia={navegacao.aoAbrirNoticia}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
