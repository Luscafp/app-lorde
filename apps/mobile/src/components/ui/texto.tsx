import { Text, type TextProps } from 'react-native'

const VARIANTES = {
  titulo: 'text-2xl font-semibold text-texto',
  subtitulo: 'text-lg font-semibold text-texto',
  corpo: 'text-base text-texto',
  rotulo: 'text-sm font-medium text-texto',
  legenda: 'text-sm text-texto-suave',
  erro: 'text-sm text-erro',
} as const

export type VarianteTexto = keyof typeof VARIANTES

type Props = TextProps & { variante?: VarianteTexto }

export function Texto({ variante = 'corpo', className, ...props }: Props) {
  return (
    <Text
      accessibilityRole={variante === 'titulo' ? 'header' : undefined}
      className={`${VARIANTES[variante]} ${className ?? ''}`}
      {...props}
    />
  )
}
