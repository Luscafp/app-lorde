import Ionicons from '@expo/vector-icons/Ionicons'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { paleta } from '@/features/atletica'
import { Texto } from './texto'

export type VarianteAlerta = 'erro' | 'alerta'

const ICONES = { erro: 'alert-circle', alerta: 'warning' } as const

type Props = { variante?: VarianteAlerta; titulo?: string; children: ReactNode }

/** Caixa de aviso dentro da tela; o ícone e o título não dependem só da cor. */
export function Alerta({ variante = 'erro', titulo, children }: Props) {
  const cor = paleta[variante]

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-start gap-3 rounded-2xl border bg-superficie p-4"
      style={{ borderColor: cor }}
    >
      <Ionicons name={ICONES[variante]} size={20} color={cor} />
      <View className="flex-1 gap-1">
        {titulo && (
          <Texto variante="rotulo" style={{ color: cor }}>
            {titulo}
          </Texto>
        )}
        {typeof children === 'string' ? <Texto variante="legenda">{children}</Texto> : children}
      </View>
    </View>
  )
}
