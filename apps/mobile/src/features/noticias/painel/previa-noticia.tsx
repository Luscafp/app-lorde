import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { NoticiaDetalhe } from '../components'
import { useNoticiaPainel } from './hooks'

/** Mesmo componente da leitura pública (#78, convenções §11.6): sem renderizador próprio. */
export function PreviaNoticia({ id }: { id: string }) {
  const consulta = useNoticiaPainel(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(noticia) => <NoticiaDetalhe noticia={noticia} />}
      </TelaDados>
    </View>
  )
}
