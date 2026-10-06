import type { Modalidade } from '@atletica/shared'
import { FlatList, Switch, View } from 'react-native'
import { BotaoIcone, CartaoLinha, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ModalidadeIcone } from './modalidade-icone'

type Props = {
  modalidades: Modalidade[]
  podeExcluir: boolean
  /** Toggle e excluir ficam desabilitados offline ou durante a ação. */
  acoesHabilitadas: boolean
  aoEditar: (modalidade: Modalidade) => void
  aoAlternar: (modalidade: Modalidade, ativa: boolean) => void
  aoExcluir: (modalidade: Modalidade) => void
}

export function ListaModalidadesPainel({
  modalidades,
  podeExcluir,
  acoesHabilitadas,
  aoEditar,
  aoAlternar,
  aoExcluir,
}: Props) {
  const { corPrimaria } = useAtletica()

  return (
    <FlatList
      data={modalidades}
      keyExtractor={({ id }) => id}
      contentContainerClassName="gap-2 p-4"
      extraData={acoesHabilitadas}
      renderItem={({ item }) => (
        <CartaoLinha>
          <ModalidadeIcone
            icone={item.icone}
            cor={item.ativa ? corPrimaria : paleta['texto-suave']}
          />
          <View className="flex-1 gap-1">
            <Texto>{item.nome}</Texto>
            {!item.ativa && (
              <Texto variante="legenda" className="self-start rounded bg-superficie px-2 text-xs">
                INATIVA
              </Texto>
            )}
          </View>
          <Switch
            accessibilityLabel={`Ativa: ${item.nome}`}
            value={item.ativa}
            disabled={!acoesHabilitadas}
            onValueChange={(ativa) => aoAlternar(item, ativa)}
            trackColor={{ true: corPrimaria, false: paleta.borda }}
          />
          <BotaoIcone
            icone="create-outline"
            rotulo={`Editar ${item.nome}`}
            onPress={() => aoEditar(item)}
          />
          {podeExcluir && (
            <BotaoIcone
              icone="trash-outline"
              rotulo={`Excluir ${item.nome}`}
              cor={paleta.erro}
              disabled={!acoesHabilitadas}
              onPress={() => aoExcluir(item)}
            />
          )}
        </CartaoLinha>
      )}
    />
  )
}
