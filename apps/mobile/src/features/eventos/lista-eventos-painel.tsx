import Ionicons from '@expo/vector-icons/Ionicons'
import { PeriodoEventos, StatusEvento, type EventoResumoDto } from '@atletica/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { ListaInfinita, TelaDados } from '@/components/estado'
import { Fab, Pilulas, Segmentos, Selo, type Opcao, type Segmento } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { linhasPorDia } from './agenda'
import { CabecalhoDia, EventoCard, OPCOES_TIPO } from './components'
import { useEventosPainel, type FiltrosEventosPainel } from './hooks'

export const MENSAGEM_SEM_EVENTOS_PAINEL = 'Nenhum evento cadastrado'
export const MENSAGEM_SEM_EVENTOS_FILTRADOS_PAINEL = 'Nenhum evento para os filtros escolhidos'
export const MENSAGEM_ERRO_EVENTOS_PAINEL = 'Não foi possível carregar os eventos'

const OPCOES_PERIODO: readonly Segmento<PeriodoEventos>[] = [
  { valor: PeriodoEventos.PROXIMOS, rotulo: 'Próximos' },
  { valor: PeriodoEventos.PASSADOS, rotulo: 'Passados' },
  { valor: PeriodoEventos.TODOS, rotulo: 'Todos' },
]

const OPCOES_STATUS: readonly Opcao<StatusEvento>[] = [
  { valor: undefined, rotulo: 'Todos os status' },
  { valor: StatusEvento.AGENDADO, rotulo: 'Agendados' },
  { valor: StatusEvento.EM_ANDAMENTO, rotulo: 'Em andamento' },
  { valor: StatusEvento.FINALIZADO, rotulo: 'Finalizados' },
  { valor: StatusEvento.CANCELADO, rotulo: 'Cancelados' },
]

const FILTROS_INICIAIS: FiltrosEventosPainel = { periodo: PeriodoEventos.PROXIMOS }

/** A #74 acrescenta o selo "Resultado pendente". */
function SelosPainel({ evento }: { evento: EventoResumoDto }) {
  return evento.serieId ? <Selo texto="RECORRENTE" /> : null
}

export type NavegacaoEventos = {
  novo: () => void
  abrir: (id: string) => void
}

export function ListaEventosPainel({ ir }: { ir: NavegacaoEventos }) {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const consulta = useEventosPainel(filtros)
  const filtrado = filtros.tipo !== undefined || filtros.status !== undefined
  const mudar = (parcial: Partial<FiltrosEventosPainel>) => setFiltros({ ...filtros, ...parcial })

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-2 p-4">
        <Segmentos
          opcoes={OPCOES_PERIODO}
          valor={filtros.periodo}
          aoMudar={(periodo) => mudar({ periodo })}
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
        mensagemVazio={
          filtrado ? MENSAGEM_SEM_EVENTOS_FILTRADOS_PAINEL : MENSAGEM_SEM_EVENTOS_PAINEL
        }
        acaoVazio={
          filtrado
            ? { titulo: 'Limpar filtros', onPress: () => setFiltros({ periodo: filtros.periodo }) }
            : { titulo: 'Novo evento', onPress: ir.novo }
        }
        mensagemErro={MENSAGEM_ERRO_EVENTOS_PAINEL}
      >
        {(eventos) => (
          <ListaInfinita
            testID="lista-eventos-painel"
            consulta={consulta}
            data={linhasPorDia(eventos)}
            keyExtractor={(linha) => linha.dia ?? linha.evento.id}
            contentContainerClassName="gap-2 px-4 pb-24"
            renderItem={({ item }) =>
              item.dia !== undefined ? (
                <CabecalhoDia dia={item.dia} />
              ) : (
                <EventoCard
                  evento={item.evento}
                  aoAbrir={({ id }) => ir.abrir(id)}
                  selos={<SelosPainel evento={item.evento} />}
                  direita={
                    <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
                  }
                />
              )
            }
          />
        )}
      </TelaDados>
      <Fab rotulo="Novo evento" onPress={ir.novo} />
    </View>
  )
}
