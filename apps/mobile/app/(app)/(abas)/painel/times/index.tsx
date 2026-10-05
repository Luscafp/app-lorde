import { ehPresidencia, EscopoTimes, type TimeDto } from '@atletica/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Switch, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Botao, Pilulas, Texto, toast, type Opcao } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { useModalidades } from '@/features/modalidades'
import { ItemTimePainel, useAtualizarTime, useExcluirTime, useTimes } from '@/features/times'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { useSessao } from '@/infra/sessao/store'

const novoTime = () => router.push('/painel/times/novo')

export default function TimesPainel() {
  const { sigla, nome, corPrimaria } = useAtletica()
  const [escopo, setEscopo] = useState<EscopoTimes>(EscopoTimes.PROPRIOS)
  const [modalidadeId, setModalidadeId] = useState<string>()
  const [incluirInativos, setIncluirInativos] = useState(false)
  const consulta = useTimes({ escopo, modalidadeId, incluirInativos })
  const { data: modalidades = [] } = useModalidades({ incluirInativas: true })
  const podeExcluir = useSessao((estado) => !!estado.usuario && ehPresidencia(estado.usuario.papel))
  const alternar = useAtualizarTime()
  const excluir = useExcluirTime()
  const proprios = escopo === EscopoTimes.PROPRIOS
  const acoesHabilitadas = alternar.online && !alternar.isPending && !excluir.isPending

  const opcoesEscopo: readonly Opcao<EscopoTimes>[] = [
    { valor: EscopoTimes.PROPRIOS, rotulo: `Times da ${sigla ?? nome}` },
    { valor: EscopoTimes.ADVERSARIOS, rotulo: 'Adversários' },
  ]
  const opcoesModalidade: readonly Opcao<string>[] = [
    { valor: undefined, rotulo: 'Todas' },
    ...modalidades.map(({ id, nome: rotulo }) => ({ valor: id, rotulo })),
  ]

  const definirAtivo = (time: TimeDto, ativo: boolean) =>
    alternar.mutate({ id: time.id, dados: { ativo } })
  const desativar = (time: TimeDto) => definirAtivo(time, false)

  function aoAlternar(time: TimeDto, ativo: boolean) {
    if (ativo) return definirAtivo(time, true)
    Alert.alert(`Desativar ${time.nome}?`, 'Ele deixará de aparecer na aba Times.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => desativar(time) },
    ])
  }

  function confirmarExclusao(time: TimeDto) {
    excluir.mutate(time.id, {
      onSuccess: () => toast.sucesso('Time excluído'),
      onError: (erro) => {
        if (erro.code !== 'TIME_COM_DEPENDENCIAS') return
        toast.erro(erro.message, { rotulo: 'Desativar', aoTocar: () => desativar(time) })
      },
    })
  }

  function aoExcluir(time: TimeDto) {
    Alert.alert(`Excluir ${time.nome}?`, 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => confirmarExclusao(time) },
    ])
  }

  const carregarMais = () => {
    if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage()
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <Pilulas
          rotulo="Times próprios ou adversários"
          opcoes={opcoesEscopo}
          valor={escopo}
          aoMudar={(valor) => setEscopo(valor ?? EscopoTimes.PROPRIOS)}
        />
        <Pilulas
          rotulo="Filtrar por modalidade"
          opcoes={opcoesModalidade}
          valor={modalidadeId}
          aoMudar={setModalidadeId}
        />
        <View className="min-h-[44px] flex-row items-center justify-between">
          <Texto>Mostrar inativos</Texto>
          <Switch
            accessibilityLabel="Mostrar inativos"
            value={incluirInativos}
            onValueChange={setIncluirInativos}
            trackColor={{ true: corPrimaria, false: paleta.borda }}
          />
        </View>
        <View className="flex-row gap-3">
          <Botao
            titulo="Modalidades"
            variante="secundaria"
            className="flex-1"
            onPress={() => router.push('/painel/modalidades')}
          />
          <Botao
            titulo="Atléticas adversárias"
            variante="secundaria"
            className="flex-1"
            onPress={() => router.push('/painel/times/adversarias')}
          />
        </View>
        <Botao titulo="Novo time" onPress={novoTime} />
      </View>
      <TelaDados consulta={consulta} esqueleto="lista">
        {({ pages }) => {
          const times = juntarPaginas(pages)
          if (times.length === 0) {
            return proprios ? (
              <EstadoVazio
                mensagem="Nenhum time cadastrado"
                acao={{ titulo: 'Novo time', onPress: novoTime }}
              />
            ) : (
              <EstadoVazio mensagem="Nenhum adversário cadastrado" />
            )
          }
          return (
            <FlatList
              data={times}
              keyExtractor={({ id }) => id}
              contentContainerClassName="gap-2 px-4 pb-4"
              extraData={acoesHabilitadas}
              renderItem={({ item }) => (
                <ItemTimePainel
                  time={item}
                  podeExcluir={podeExcluir}
                  acoesHabilitadas={acoesHabilitadas}
                  aoEditar={({ id }) => router.push(`/painel/times/${id}/editar`)}
                  aoAbrirElenco={({ id }) => router.push(`/painel/times/${id}/elenco`)}
                  aoAlternar={aoAlternar}
                  aoExcluir={aoExcluir}
                />
              )}
              onEndReached={carregarMais}
              onEndReachedThreshold={0.5}
              refreshing={consulta.isRefetching && !consulta.isFetchingNextPage}
              onRefresh={() => void consulta.refetch()}
              ListFooterComponent={
                consulta.isFetchingNextPage ? (
                  <ActivityIndicator className="py-4" color={paleta['texto-suave']} />
                ) : null
              }
            />
          )
        }}
      </TelaDados>
    </View>
  )
}
