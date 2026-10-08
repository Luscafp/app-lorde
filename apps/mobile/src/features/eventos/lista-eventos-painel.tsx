import { PeriodoEventos } from '@atletica/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Fab, Pilulas, Segmentos, Selo, type Segmento } from '@/components/ui'
import { vazioEventos } from './agenda'
import { ListaEventosPorDia } from './components'
import { useEventosPainel, type FiltrosEventosPainel } from './hooks'
import { OPCOES_STATUS, OPCOES_TIPO } from './rotulos'

const MENSAGEM_SEM_EVENTOS_PAINEL = 'Nenhum evento cadastrado'
const MENSAGEM_ERRO_EVENTOS_PAINEL = 'Não foi possível carregar os eventos'

const OPCOES_PERIODO: readonly Segmento<PeriodoEventos>[] = [
  { valor: PeriodoEventos.PROXIMOS, rotulo: 'Próximos' },
  { valor: PeriodoEventos.PASSADOS, rotulo: 'Passados' },
  { valor: PeriodoEventos.TODOS, rotulo: 'Todos' },
]

const FILTROS_INICIAIS: FiltrosEventosPainel = { periodo: PeriodoEventos.PROXIMOS }

export type NavegacaoEventos = {
  novo: () => void
  abrir: (id: string) => void
}

export function ListaEventosPainel({ ir }: { ir: NavegacaoEventos }) {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const consulta = useEventosPainel(filtros)
  const { periodo, ...filtrosDaLista } = filtros
  const mudar = (parcial: Partial<FiltrosEventosPainel>) => setFiltros({ ...filtros, ...parcial })

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-2 p-4">
        <Segmentos
          opcoes={OPCOES_PERIODO}
          valor={periodo}
          aoMudar={(novoPeriodo) => mudar({ periodo: novoPeriodo })}
        />
        <Pilulas
          rotulo="Tipo de evento"
          opcoes={OPCOES_TIPO}
          valor={filtros.tipo}
          aoMudar={(tipo) => mudar({ tipo })}
        />
        <Pilulas
          rotulo="Status"
          opcoes={OPCOES_STATUS}
          valor={filtros.status}
          aoMudar={(status) => mudar({ status })}
        />
      </View>
      <TelaDados
        consulta={consulta}
        esqueleto="cartoes"
        vazio={(eventos) => eventos.length === 0}
        {...vazioEventos(filtrosDaLista, () => setFiltros({ periodo }), {
          mensagem: MENSAGEM_SEM_EVENTOS_PAINEL,
          acao: { titulo: 'Novo evento', onPress: ir.novo },
        })}
        mensagemErro={MENSAGEM_ERRO_EVENTOS_PAINEL}
      >
        {(eventos) => (
          <ListaEventosPorDia
            testID="lista-eventos-painel"
            consulta={consulta}
            eventos={eventos}
            contentContainerClassName="gap-2 px-4 pb-24"
            aoAbrir={({ id }) => ir.abrir(id)}
            selos={(evento) => (evento.serieId ? <Selo texto="RECORRENTE" /> : null)}
          />
        )}
      </TelaDados>
      <Fab rotulo="Novo evento" onPress={ir.novo} />
    </View>
  )
}
