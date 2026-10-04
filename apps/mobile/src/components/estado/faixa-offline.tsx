import Ionicons from '@expo/vector-icons/Ionicons'
import { formatarDataHora } from '@atletica/shared'
import { View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

/** Só apresenta a faixa; quem a usa decide se está offline. */
export function FaixaOffline({ atualizadoEm }: { atualizadoEm?: number | Date }) {
  const texto = atualizadoEm
    ? `Modo offline · dados de ${formatarDataHora(atualizadoEm)}`
    : 'Modo offline'

  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2 border-b border-alerta/40 bg-superficie px-4 py-2"
    >
      <Ionicons name="cloud-offline-outline" size={18} color={paleta.alerta} />
      <Texto variante="legenda" className="flex-1 text-texto">
        {texto}
      </Texto>
    </View>
  )
}
