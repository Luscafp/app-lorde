import { Modal, Pressable, View } from 'react-native'
import { Botao } from './botao'

export type OpcaoMenu = { titulo: string; aoTocar: () => void; perigo?: boolean }

type Props = { visivel: boolean; opcoes: readonly OpcaoMenu[]; aoFechar: () => void }

/** Bottom sheet de ações; tocar fora ou em "Cancelar" fecha. */
export function MenuInferior({ visivel, opcoes, aoFechar }: Props) {
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      <Pressable testID="menu-inferior-fundo" className="flex-1 bg-black/40" onPress={aoFechar} />
      <View className="gap-2 rounded-t-3xl bg-superficie p-4 pb-8">
        {opcoes.map(({ titulo, aoTocar, perigo }) => (
          <Botao
            key={titulo}
            titulo={titulo}
            variante={perigo ? 'perigo' : 'secundaria'}
            onPress={() => {
              aoFechar()
              aoTocar()
            }}
          />
        ))}
        <Botao titulo="Cancelar" variante="secundaria" onPress={aoFechar} />
      </View>
    </Modal>
  )
}
