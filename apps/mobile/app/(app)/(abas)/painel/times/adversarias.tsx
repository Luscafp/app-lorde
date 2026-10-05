import type { AtleticaAdversaria } from '@atletica/shared'
import { useState } from 'react'
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Botao, BotaoIcone, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { rotuloAtletica, SheetAtleticaAdversaria, useAtleticasAdversarias } from '@/features/times'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'

const ATRASO_BUSCA_MS = 300

type Edicao = { atletica?: AtleticaAdversaria }

function totalDeTimes(total: number): string {
  return total === 1 ? '1 time' : `${total} times`
}

export default function AtleticasAdversarias() {
  const [termo, setTermo] = useState('')
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const busca = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS)
  const consulta = useAtleticasAdversarias(busca || undefined)
  const nova = () => setEdicao({})
  const fechar = () => setEdicao(null)

  const carregarMais = () => {
    if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage()
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <TextInput
          value={termo}
          onChangeText={setTermo}
          accessibilityLabel="Buscar atlética adversária"
          placeholder="Buscar atlética adversária"
          placeholderTextColor={paleta['texto-suave']}
          autoCorrect={false}
          returnKeyType="search"
          className="min-h-[44px] rounded-xl border border-borda bg-superficie px-3 py-2 text-base text-texto"
        />
        <Botao titulo="Nova atlética" onPress={nova} />
      </View>
      <TelaDados consulta={consulta} esqueleto="lista">
        {({ pages }) => {
          const atleticas = juntarPaginas(pages)
          if (atleticas.length === 0) {
            return busca ? (
              <EstadoVazio mensagem="Nenhuma atlética adversária encontrada" />
            ) : (
              <EstadoVazio
                mensagem="Nenhuma atlética adversária cadastrada"
                acao={{ titulo: 'Nova atlética', onPress: nova }}
              />
            )
          }
          return (
            <FlatList
              data={atleticas}
              keyExtractor={({ id }) => id}
              contentContainerClassName="gap-2 px-4 pb-4"
              renderItem={({ item }) => (
                <View className="flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao px-3 py-2">
                  <View className="flex-1 gap-1">
                    <Texto className="font-semibold">{rotuloAtletica(item)}</Texto>
                    <Texto variante="legenda">
                      {[item.curso, totalDeTimes(item.totalTimes)].filter(Boolean).join(' · ')}
                    </Texto>
                  </View>
                  <BotaoIcone
                    icone="create-outline"
                    rotulo={`Editar ${item.nome}`}
                    onPress={() => setEdicao({ atletica: item })}
                  />
                </View>
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
      {edicao && (
        <SheetAtleticaAdversaria atletica={edicao.atletica} aoSalvar={fechar} aoFechar={fechar} />
      )}
    </View>
  )
}
