import { Pressable, ScrollView, Text } from 'react-native'
import { paleta, useAtletica } from '@/features/atletica'

export type Opcao<T> = { valor: T | undefined; rotulo: string }

export function Pilulas<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string
  opcoes: readonly Opcao<T>[]
  valor: T | undefined
  aoMudar: (valor: T | undefined) => void
}) {
  const { corPrimaria } = useAtletica()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={rotulo}
      contentContainerClassName="gap-2"
    >
      {opcoes.map((opcao) => {
        const selecionada = opcao.valor === valor
        return (
          <Pressable
            key={opcao.rotulo}
            accessibilityRole="radio"
            accessibilityLabel={opcao.rotulo}
            accessibilityState={{ selected: selecionada }}
            onPress={() => aoMudar(opcao.valor)}
            className="min-h-[44px] justify-center rounded-full border px-4"
            style={{ borderColor: selecionada ? corPrimaria : paleta.borda }}
          >
            <Text
              className={`text-sm ${selecionada ? 'font-semibold' : ''}`}
              style={{ color: selecionada ? corPrimaria : paleta.texto }}
            >
              {opcao.rotulo}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
