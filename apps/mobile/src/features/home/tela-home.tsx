import { PeriodoEventos } from '@atletica/shared'
import { RefreshControl, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FaixaOffline } from '@/components/estado'
import { paleta } from '@/features/atletica'
import { CarrosselBanners, useBanners } from '@/features/banners'
import { useProximosEventos, type AbaAgenda } from '@/features/eventos'
import { useUltimasNoticias } from '@/features/noticias'
import { combinarConsultas } from '@/infra/query/combinar-consultas'
import { useOnline } from '@/infra/rede/online'
import { useMarcarHomePronta } from '@/infra/sentry'
import { HomeAtalhos } from './home-atalhos'
import { HomeHeader } from './home-header'
import { SecaoProximosEventos } from './secao-proximos-eventos'
import { SecaoUltimasNoticias } from './secao-ultimas-noticias'

const LIMITE_PROXIMOS_EVENTOS = 5

type NavegacaoHome = {
  aoAbrirAgenda: (aba: AbaAgenda) => void
  aoAbrirTimes: () => void
  aoAbrirNoticias: () => void
  aoAbrirEvento: (id: string) => void
  aoAbrirNoticia: (id: string) => void
  aoAbrirPerfil: () => void
}

export function TelaHome(navegacao: NavegacaoHome) {
  const eventos = useProximosEventos({ periodo: PeriodoEventos.PROXIMOS }, LIMITE_PROXIMOS_EVENTOS)
  const noticias = useUltimasNoticias()
  const banners = useBanners()
  const secoes = combinarConsultas([eventos, noticias, banners])
  const online = useOnline()
  const emCache = [eventos, noticias, banners].filter(({ data }) => data !== undefined)

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
        <CarrosselBanners />
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
