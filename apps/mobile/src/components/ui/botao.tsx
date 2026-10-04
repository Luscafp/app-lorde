import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native'
import { corTextoSobre, paleta, useAtletica } from '@/features/atletica'

export type VarianteBotao = 'primaria' | 'secundaria' | 'perigo'

type Props = Omit<PressableProps, 'children' | 'style'> & {
  titulo: string
  variante?: VarianteBotao
  carregando?: boolean
  className?: string
}

function useCores(variante: VarianteBotao) {
  const { corPrimaria } = useAtletica()
  if (variante === 'primaria') return { fundo: corPrimaria, texto: corTextoSobre(corPrimaria) }
  if (variante === 'perigo') return { fundo: paleta.erro, texto: corTextoSobre(paleta.erro) }
  return { fundo: 'transparent', texto: paleta.texto }
}

export function Botao({
  titulo,
  variante = 'primaria',
  carregando = false,
  disabled,
  onPressIn,
  onPressOut,
  className,
  ...props
}: Props) {
  const [pressionado, setPressionado] = useState(false)
  const cores = useCores(variante)
  const desabilitado = Boolean(disabled) || carregando

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: desabilitado, busy: carregando }}
      disabled={desabilitado}
      onPressIn={(evento) => {
        setPressionado(true)
        onPressIn?.(evento)
      }}
      onPressOut={(evento) => {
        setPressionado(false)
        onPressOut?.(evento)
      }}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${
        variante === 'secundaria' ? 'border border-borda' : ''
      } ${className ?? ''}`}
      style={{
        backgroundColor: cores.fundo,
        opacity: desabilitado ? 0.5 : pressionado ? 0.7 : 1,
      }}
      {...props}
    >
      {carregando && <ActivityIndicator testID="botao-spinner" color={cores.texto} />}
      <Text className="text-base font-semibold" style={{ color: cores.texto }}>
        {titulo}
      </Text>
    </Pressable>
  )
}
