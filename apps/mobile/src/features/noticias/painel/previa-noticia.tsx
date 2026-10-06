import type { ComponentProps } from 'react'
import { Modal, View } from 'react-native'
import { Botao } from '@/components/ui'
import { NoticiaDetalhe } from '../components'

type Props = {
  noticia: ComponentProps<typeof NoticiaDetalhe>['noticia']
  aoFechar: () => void
}

/** Mesmo componente da leitura pública (#78, convenções §11.6): sem renderizador próprio. */
export function PreviaNoticia({ noticia, aoFechar }: Props) {
  return (
    <Modal animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 bg-fundo">
        <NoticiaDetalhe noticia={noticia} />
        <View className="p-4">
          <Botao titulo="Fechar prévia" variante="secundaria" onPress={aoFechar} />
        </View>
      </View>
    </Modal>
  )
}
