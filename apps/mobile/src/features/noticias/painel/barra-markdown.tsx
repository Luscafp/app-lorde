import { View } from 'react-native'
import { Botao } from '@/components/ui'
import type { Marcacao } from './marcacao'

const BOTOES: { marcacao: Marcacao; titulo: string }[] = [
  { marcacao: 'negrito', titulo: 'Negrito' },
  { marcacao: 'italico', titulo: 'Itálico' },
  { marcacao: 'lista', titulo: 'Lista' },
  { marcacao: 'link', titulo: 'Link' },
]

export function BarraMarkdown({ aoAplicar }: { aoAplicar: (marcacao: Marcacao) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {BOTOES.map(({ marcacao, titulo }) => (
        <Botao
          key={marcacao}
          titulo={titulo}
          variante="secundaria"
          onPress={() => aoAplicar(marcacao)}
        />
      ))}
    </View>
  )
}
