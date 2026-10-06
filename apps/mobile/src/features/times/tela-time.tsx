import type { TimeDto } from '@atletica/shared'
import { RefreshControl, ScrollView, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { ModalidadeIcone } from '@/features/modalidades'
import { ehNaoEncontrado } from '@/infra/api/api-erro'
import { AcaoEntradaTime } from './acao-entrada-time'
import { contar } from './formatacao'
import { useElenco, useTime } from './hooks'
import { ListaElenco } from './lista-elenco'

export const MENSAGEM_TIME_NAO_ENCONTRADO = 'Time não encontrado'

export function CabecalhoTime({ time }: { time: TimeDto }) {
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

/** Os próximos treinos (#67) entram como seção entre o elenco e a ação. */
export function TelaTime({ timeId, aoVoltar }: { timeId: string; aoVoltar: () => void }) {
  const time = useTime(timeId)
  const elenco = useElenco(timeId)
  const atualizar = () => void Promise.all([time.refetch(), elenco.refetch()])

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
          <ScrollView
            contentContainerClassName="gap-6 p-4"
            refreshControl={
              <RefreshControl
                refreshing={time.isRefetching || elenco.isRefetching}
                onRefresh={atualizar}
              />
            }
          >
            <CabecalhoTime time={dados} />
            <ListaElenco consulta={elenco} />
            <AcaoEntradaTime time={dados} />
          </ScrollView>
        )}
      </TelaDados>
    </View>
  )
}
