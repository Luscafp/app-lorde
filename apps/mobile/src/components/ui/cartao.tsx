import { View, type ViewProps } from 'react-native'

export function Cartao({ className, ...props }: ViewProps) {
  return (
    <View
      className={`gap-2 rounded-2xl border border-borda bg-cartao p-4 ${className ?? ''}`}
      {...props}
    />
  )
}

/** Item de lista do Painel: ícone, textos e ações na mesma linha. */
export function CartaoLinha({ className, ...props }: ViewProps) {
  return (
    <View
      className={`flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao px-3 py-2 ${className ?? ''}`}
      {...props}
    />
  )
}
