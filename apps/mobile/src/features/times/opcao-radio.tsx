import Ionicons from '@expo/vector-icons/Ionicons'
import type { ReactNode } from 'react'
import { Pressable } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'

type Props = {
  rotulo: string
  marcada: boolean
  desabilitada?: boolean
  aoEscolher: () => void
  /** Sem ele, mostra o círculo de rádio. */
  icone?: (cor: string) => ReactNode
}

export function OpcaoRadio({ rotulo, marcada, desabilitada, aoEscolher, icone }: Props) {
  const { corPrimaria } = useAtletica()
  const cor = marcada ? corPrimaria : paleta['texto-suave']

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: marcada, disabled: !!desabilitada }}
      disabled={desabilitada}
      onPress={aoEscolher}
      className="min-h-[44px] flex-row items-center gap-2 rounded-xl border-2 bg-superficie px-3 py-2"
      style={{ borderColor: marcada ? corPrimaria : paleta.borda, opacity: desabilitada ? 0.5 : 1 }}
    >
      {icone ? (
        icone(cor)
      ) : (
        <Ionicons name={marcada ? 'radio-button-on' : 'radio-button-off'} size={18} color={cor} />
      )}
      <Texto className="shrink" style={marcada ? { color: corPrimaria } : undefined}>
        {rotulo}
      </Texto>
    </Pressable>
  )
}
