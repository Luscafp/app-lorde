import type { AtleticaAdversaria } from '@atletica/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { EstadoVazio, ListaInfinita, TelaDados } from '@/components/estado'
import { Botao, BotaoIcone, CampoBusca, CartaoLinha, Texto } from '@/components/ui'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { SheetAtleticaAdversaria } from './form-atletica-adversaria'
import { contar, rotuloAtletica } from './formatacao'
import { useBuscaAdversarias } from './hooks'

type Edicao = { atletica?: AtleticaAdversaria }

export function ListaAtleticasAdversarias() {
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const { termo, setTermo, busca, consulta } = useBuscaAdversarias()
  const nova = () => setEdicao({})
  const fechar = () => setEdicao(null)

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <CampoBusca rotulo="Buscar atlética adversária" valor={termo} aoMudar={setTermo} />
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
            <ListaInfinita
              consulta={consulta}
              data={atleticas}
              keyExtractor={({ id }) => id}
              contentContainerClassName="gap-2 px-4 pb-4"
              renderItem={({ item }) => (
                <CartaoLinha>
                  <View className="flex-1 gap-1">
                    <Texto className="font-semibold">{rotuloAtletica(item)}</Texto>
                    <Texto variante="legenda">
                      {[item.curso, contar(item.totalTimes, 'time', 'times')]
                        .filter(Boolean)
                        .join(' · ')}
                    </Texto>
                  </View>
                  <BotaoIcone
                    icone="create-outline"
                    rotulo={`Editar ${item.nome}`}
                    onPress={() => setEdicao({ atletica: item })}
                  />
                </CartaoLinha>
              )}
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
