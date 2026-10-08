import { PeriodoEventos, StatusEvento, TipoEvento } from '@atletica/shared'
import { View } from 'react-native'
import { ListaInfinita, TelaDados } from '@/components/estado'
import type { PropsSegmentoAgenda } from '../../agenda'
import { useEventos } from '../../consultas'
import { FiltroModalidade } from '../filtros-agenda'
import { ResultadoCard } from './resultado-card'

export const MENSAGEM_SEM_RESULTADOS = 'Nenhum resultado registrado'
export const MENSAGEM_ERRO_PLACAR = 'Não foi possível carregar o placar'

/** RN15: só jogos finalizados, do mais recente ao mais antigo; o tipo da URL é ignorado. */
export function PlacarLista({ filtros, aoMudarFiltros, aoAbrirEvento }: PropsSegmentoAgenda) {
  const { modalidadeId } = filtros
  const mudarModalidade = (id: string | undefined) =>
    aoMudarFiltros({ ...filtros, modalidadeId: id })
  const consulta = useEventos({
    periodo: PeriodoEventos.TODOS,
    tipo: TipoEvento.JOGO,
    status: StatusEvento.FINALIZADO,
    ordem: 'desc',
    modalidadeId,
  })

  return (
    <View className="flex-1 gap-2">
      <View className="px-4">
        <FiltroModalidade valor={modalidadeId} aoMudar={mudarModalidade} />
      </View>
      <TelaDados
        consulta={consulta}
        esqueleto="cartoes"
        vazio={(eventos) => eventos.length === 0}
        mensagemVazio={MENSAGEM_SEM_RESULTADOS}
        acaoVazio={
          modalidadeId !== undefined
            ? { titulo: 'Limpar filtro', onPress: () => mudarModalidade(undefined) }
            : undefined
        }
        mensagemErro={MENSAGEM_ERRO_PLACAR}
      >
        {(eventos) => (
          <ListaInfinita
            testID="lista-placar"
            consulta={consulta}
            data={eventos}
            keyExtractor={({ id }) => id}
            contentContainerClassName="gap-2 p-4"
            renderItem={({ item }) => <ResultadoCard evento={item} aoAbrir={aoAbrirEvento} />}
          />
        )}
      </TelaDados>
    </View>
  )
}
