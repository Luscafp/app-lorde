import { ScrollView } from 'react-native'
import { useAtletica } from '@/features/atletica'
import { Pilula } from './pilula'

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
      {opcoes.map((opcao) => (
        <Pilula
          key={opcao.rotulo}
          rotulo={opcao.rotulo}
          ativa={opcao.valor === valor}
          cor={corPrimaria}
          aoPressionar={() => aoMudar(opcao.valor)}
        />
      ))}
    </ScrollView>
  )
}
