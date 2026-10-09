import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { FormBanner, useBannerPainel } from '@/features/banners'

export default function EditarBanner() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useBannerPainel(id)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(banner) => <FormBanner banner={banner} aoConcluir={() => router.back()} />}
      </TelaDados>
    </View>
  )
}
