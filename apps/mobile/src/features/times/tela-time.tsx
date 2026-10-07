import { TipoEvento, type TimeDto } from '@atletica/shared'
import { RefreshControl, ScrollView, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import type { FiltrosSelecionados } from '@/features/eventos'
import { ModalidadeIcone } from '@/features/modalidades'
import { AcaoEntradaTime } from '@/features/solicitacoes'
import { ehNaoEncontrado } from '@/infra/api/api-erro'
import { combinarConsultas } from '@/infra/query/combinar-consultas'
import { contar } from './formatacao'
import { useElenco, useProximosTreinos, useTime } from './hooks'
import { ListaElenco } from './lista-elenco'
import { ProximosTreinos } from './proximos-treinos'

export const MENSAGEM_TIME_NAO_ENCONTRADO = 'Time não encontrado'

function CabecalhoTime({ time }: { time: TimeDto }) {
  const { corPrimaria } = useAtletica()
  const { modalidade, atletica } = time

  return (
    <View className="items-center gap-1">
      <ModalidadeIcone icone={modalidade.icone} tamanho={40} cor={corPrimaria} />
      <Texto variante="legenda">{`${modalidade.nome} · ${atletica.sigla ?? atletica.nome}`}</Texto>
      <Texto variante="titulo" className="text-center">
        {time.nome}
      </Texto>
      <Texto variante="legenda">{contar(time.totalMembros, 'atleta', 'atletas')}</Texto>
    </View>
  )
}

export type NavegacaoTime = {
  aoVoltar: () => void
  aoAbrirEvento: (id: string) => void
  aoVerAgenda: (filtros: FiltrosSelecionados) => void
}

type Props = NavegacaoTime & { timeId: string }

export function TelaTime({ timeId, aoVoltar, aoAbrirEvento, aoVerAgenda }: Props) {
  const time = useTime(timeId)
  const elenco = useElenco(timeId)
  const treinos = useProximosTreinos(timeId)
  const todas = combinarConsultas([time, elenco, treinos])

  if (ehNaoEncontrado(time.error)) {
    return (
      <View className="flex-1 bg-fundo">
        <EstadoVazio
          mensagem={MENSAGEM_TIME_NAO_ENCONTRADO}
          acao={{ titulo: 'Voltar para Times', onPress: aoVoltar }}
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={time} esqueleto="detalhe">
        {(dados) => (
          <>
            <ScrollView
              testID="detalhe-time"
              contentContainerClassName="gap-6 p-4"
              refreshControl={
                <RefreshControl
                  refreshing={todas.isRefetching}
                  onRefresh={() => void todas.refetch()}
                />
              }
            >
              <CabecalhoTime time={dados} />
              <ListaElenco consulta={elenco} />
              <ProximosTreinos
                consulta={treinos}
                aoAbrirTreino={aoAbrirEvento}
                aoVerAgenda={() =>
                  aoVerAgenda({ tipo: TipoEvento.TREINO, modalidadeId: dados.modalidade.id })
                }
              />
            </ScrollView>
            <AcaoEntradaTime time={dados} aoTimeIndisponivel={aoVoltar} />
          </>
        )}
      </TelaDados>
    </View>
  )
}
