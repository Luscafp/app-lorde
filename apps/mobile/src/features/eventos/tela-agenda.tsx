import Ionicons from '@expo/vector-icons/Ionicons'
import { PeriodoEventos, type EventoResumoDto } from '@atletica/shared'
import { View } from 'react-native'
import { ListaInfinita, TelaDados } from '@/components/estado'
import { Segmentos, Texto, type Segmento } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { agruparPorDia, type AbaAgenda, type FiltrosSelecionados } from './agenda'
import { CabecalhoDia, EventoCard, FiltrosAgenda, MinhaRespostaChip } from './components'
import { useEventos } from './consultas'

export const MENSAGEM_SEM_EVENTOS = 'Nenhum evento agendado'
export const MENSAGEM_SEM_EVENTOS_FILTRADOS = 'Nenhum evento para os filtros escolhidos'
export const MENSAGEM_ERRO_AGENDA = 'Não foi possível carregar a agenda'

const SEGMENTOS: readonly Segmento<AbaAgenda>[] = [
  { valor: 'eventos', rotulo: 'Jogos e treinos' },
  { valor: 'placar', rotulo: 'Placar' },
]

type Linha = { dia: string; evento?: undefined } | { dia?: undefined; evento: EventoResumoDto }

function linhas(eventos: EventoResumoDto[]): Linha[] {
  return agruparPorDia(eventos).flatMap(({ dia, eventos: doDia }) => [
    { dia },
    ...doDia.map((evento) => ({ evento })),
  ])
}

type PropsEventos = {
  filtros: FiltrosSelecionados
  aoMudarFiltros: (filtros: FiltrosSelecionados) => void
  aoAbrirEvento: (evento: EventoResumoDto) => void
}

function JogosETreinos({ filtros, aoMudarFiltros, aoAbrirEvento }: PropsEventos) {
  const consulta = useEventos({ periodo: PeriodoEventos.PROXIMOS, ...filtros })
  const filtrado = filtros.tipo !== undefined || filtros.modalidadeId !== undefined

  return (
    <View className="flex-1 gap-2">
      <FiltrosAgenda filtros={filtros} aoMudar={aoMudarFiltros} />
      <TelaDados
        consulta={consulta}
        esqueleto="cartoes"
        vazio={(eventos) => eventos.length === 0}
        mensagemVazio={filtrado ? MENSAGEM_SEM_EVENTOS_FILTRADOS : MENSAGEM_SEM_EVENTOS}
        acaoVazio={
          filtrado ? { titulo: 'Limpar filtros', onPress: () => aoMudarFiltros({}) } : undefined
        }
        mensagemErro={MENSAGEM_ERRO_AGENDA}
      >
        {(eventos) => (
          <ListaInfinita
            testID="lista-agenda"
            consulta={consulta}
            data={linhas(eventos)}
            keyExtractor={(linha) => linha.dia ?? linha.evento.id}
            contentContainerClassName="gap-2 p-4"
            renderItem={({ item }) =>
              item.dia !== undefined ? (
                <CabecalhoDia dia={item.dia} />
              ) : (
                <EventoCard
                  evento={item.evento}
                  aoAbrir={aoAbrirEvento}
                  direita={
                    <View className="items-end gap-1.5">
                      <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
                      <MinhaRespostaChip evento={item.evento} />
                    </View>
                  }
                />
              )
            }
          />
        )}
      </TelaDados>
    </View>
  )
}

type Props = PropsEventos & { aba: AbaAgenda; aoMudarAba: (aba: AbaAgenda) => void }

export function TelaAgenda({ aba, aoMudarAba, ...eventos }: Props) {
  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 px-4 pb-2 pt-4">
        <Texto variante="titulo">Agenda</Texto>
        <Segmentos opcoes={SEGMENTOS} valor={aba} aoMudar={aoMudarAba} />
      </View>
      {/* Segmento Placar: `PlacarLista` da #23. */}
      {aba === 'eventos' ? <JogosETreinos {...eventos} /> : <View className="flex-1" />}
    </View>
  )
}
