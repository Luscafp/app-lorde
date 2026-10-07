import { PeriodoEventos, type EventoResumoDto } from '@atletica/shared'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Segmentos, Texto, type Segmento } from '@/components/ui'
import { vazioEventos, type AbaAgenda, type FiltrosSelecionados } from './agenda'
import { FiltrosAgenda, ListaEventosPorDia, MinhaRespostaChip } from './components'
import { useEventos } from './consultas'

export const MENSAGEM_SEM_EVENTOS = 'Nenhum evento agendado'
export const MENSAGEM_ERRO_AGENDA = 'Não foi possível carregar a agenda'

const SEGMENTOS: readonly Segmento<AbaAgenda>[] = [
  { valor: 'eventos', rotulo: 'Jogos e treinos' },
  { valor: 'placar', rotulo: 'Placar' },
]

type PropsEventos = {
  filtros: FiltrosSelecionados
  aoMudarFiltros: (filtros: FiltrosSelecionados) => void
  aoAbrirEvento: (evento: EventoResumoDto) => void
}

function JogosETreinos({ filtros, aoMudarFiltros, aoAbrirEvento }: PropsEventos) {
  const consulta = useEventos({ periodo: PeriodoEventos.PROXIMOS, ...filtros })

  return (
    <View className="flex-1 gap-2">
      <FiltrosAgenda filtros={filtros} aoMudar={aoMudarFiltros} />
      <TelaDados
        consulta={consulta}
        esqueleto="cartoes"
        vazio={(eventos) => eventos.length === 0}
        {...vazioEventos(filtros, () => aoMudarFiltros({}), { mensagem: MENSAGEM_SEM_EVENTOS })}
        mensagemErro={MENSAGEM_ERRO_AGENDA}
      >
        {(eventos) => (
          <ListaEventosPorDia
            testID="lista-agenda"
            consulta={consulta}
            eventos={eventos}
            contentContainerClassName="gap-2 p-4"
            aoAbrir={aoAbrirEvento}
            abaixoDaSeta={(evento) => <MinhaRespostaChip evento={evento} />}
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
