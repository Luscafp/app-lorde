import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { FormNoticia, useNoticiaPainel } from '@/features/noticias'

export default function EditarNoticia() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useNoticiaPainel(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(noticia) => <FormNoticia noticia={noticia} aoConcluir={() => router.back()} />}
      </TelaDados>
    </View>
  )
}
