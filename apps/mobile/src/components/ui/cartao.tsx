import { View, type ViewProps } from 'react-native'

export function Cartao({ className, ...props }: ViewProps) {
  return (
    <View
      className={`gap-2 rounded-2xl border border-borda bg-cartao p-4 ${className ?? ''}`}
      {...props}
    />
  )
}
