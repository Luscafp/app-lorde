import { Pressable, Text } from 'react-native'
import { comAlfa, paleta } from '@/features/atletica'

type Props = {
  rotulo: string
  ativa: boolean
  cor: string
  aoPressionar: () => void
  papel?: 'radio' | 'checkbox'
  desabilitada?: boolean
  className?: string
}

export function Pilula({
  rotulo,
  ativa,
  cor,
  aoPressionar,
  papel = 'radio',
  desabilitada = false,
  className = '',
}: Props) {
  const marcacao = papel === 'radio' ? { selected: ativa } : { checked: ativa }
  return (
    <Pressable
      accessibilityRole={papel}
      accessibilityLabel={rotulo}
      accessibilityState={{ ...marcacao, disabled: desabilitada }}
      disabled={desabilitada}
      onPress={aoPressionar}
      className={`min-h-[44px] justify-center rounded-full border px-4 ${className}`}
      style={{
        borderColor: ativa ? cor : paleta.borda,
        backgroundColor: ativa ? comAlfa(cor) : 'transparent',
        opacity: desabilitada ? 0.4 : 1,
      }}
    >
      <Text
        className={`text-sm ${ativa ? 'font-semibold' : ''}`}
        style={{ color: ativa ? cor : paleta.texto }}
      >
        {rotulo}
      </Text>
    </Pressable>
  )
}
