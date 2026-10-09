import { Switch, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'

type Props = {
  titulo: string
  descricao?: string
  valor: boolean
  desabilitado?: boolean
  aoMudar: (valor: boolean) => void
}

export function LinhaPreferencia({ titulo, descricao, valor, desabilitado, aoMudar }: Props) {
  const { corPrimaria } = useAtletica()
  return (
    <View
      className={`min-h-[48px] flex-row items-center gap-3 px-4 py-3 ${desabilitado ? 'opacity-50' : ''}`}
    >
      <View className="flex-1 gap-1">
        <Texto>{titulo}</Texto>
        {descricao && <Texto variante="legenda">{descricao}</Texto>}
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={titulo}
        accessibilityHint={descricao}
        accessibilityState={{ disabled: desabilitado, checked: valor }}
        value={valor}
        disabled={desabilitado}
        onValueChange={aoMudar}
        trackColor={{ true: corPrimaria, false: paleta.borda }}
      />
    </View>
  )
}
