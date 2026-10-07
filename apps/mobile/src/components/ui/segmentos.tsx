import { Pressable, Text, View } from 'react-native'
import { corTextoSobre, paleta, useAtletica } from '@/features/atletica'

export type Segmento<T> = { valor: T; rotulo: string }

export function Segmentos<T extends string>({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: readonly Segmento<T>[]
  valor: T
  aoMudar: (valor: T) => void
}) {
  const { corPrimaria } = useAtletica()
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row overflow-hidden rounded-xl border border-borda bg-cartao"
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor
        return (
          <Pressable
            key={opcao.valor}
            accessibilityRole="tab"
            accessibilityLabel={opcao.rotulo}
            accessibilityState={{ selected: ativo }}
            onPress={() => aoMudar(opcao.valor)}
            className="min-h-[44px] flex-1 items-center justify-center"
            style={ativo && { backgroundColor: corPrimaria }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: ativo ? corTextoSobre(corPrimaria) : paleta['texto-suave'] }}
            >
              {opcao.rotulo}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
