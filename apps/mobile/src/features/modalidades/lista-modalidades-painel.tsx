import Ionicons from '@expo/vector-icons/Ionicons'
import type { Modalidade } from '@atletica/shared'
import { FlatList, Pressable, Switch, View } from 'react-native'
import { Texto } from '@/components/ui'
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

function BotaoIcone({
  icone,
  rotulo,
  cor = paleta.texto,
  ...props
}: {
  icone: 'create-outline' | 'trash-outline'
  rotulo: string
  cor?: string
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!props.disabled }}
      className="h-11 w-11 items-center justify-center"
      style={{ opacity: props.disabled ? 0.5 : 1 }}
      {...props}
    >
      <Ionicons name={icone} size={22} color={cor} />
    </Pressable>
  )
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
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao px-3 py-2">
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
        </View>
      )}
    />
  )
}
