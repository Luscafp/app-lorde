import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { FormModalidade, useModalidades } from '@/features/modalidades'

/** Sem `GET /modalidades/:id`: a modalidade vem do catálogo completo (já em cache pela lista). */
export default function EditarModalidade() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useModalidades({ incluirInativas: true })

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(modalidades) => {
          const modalidade = modalidades.find((item) => item.id === id)
          if (!modalidade) return <EstadoVazio mensagem="Modalidade não encontrada." />
          return <FormModalidade modalidade={modalidade} aoSalvar={() => router.back()} />
        }}
      </TelaDados>
    </View>
  )
}
