import { ICONES_MODALIDADE, type IconeModalidade } from '@atletica/shared'
import { Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ModalidadeIcone } from './modalidade-icone'

export const ROTULO_ICONE: Readonly<Record<IconeModalidade, string>> = {
  soccer: 'Futebol',
  basketball: 'Basquete',
  volleyball: 'Vôlei',
  handball: 'Handebol',
  'table-tennis': 'Tênis de mesa',
  tennis: 'Tênis',
  badminton: 'Badminton',
  baseball: 'Beisebol',
  rugby: 'Rugby',
  football: 'Futebol americano',
  'hockey-sticks': 'Hóquei',
  'chess-knight': 'Xadrez',
  swim: 'Natação',
  run: 'Corrida',
  bike: 'Ciclismo',
  karate: 'Artes marciais',
  kabaddi: 'Lutas',
  'weight-lifter': 'Levantamento de peso',
  golf: 'Golfe',
  'gamepad-variant': 'E-sports',
  trophy: 'Genérico',
}

type Props = {
  valor: string | undefined
  aoMudar: (icone: IconeModalidade) => void
  erro?: string
}

export function SeletorIcone({ valor, aoMudar, erro }: Props) {
  const { corPrimaria } = useAtletica()

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Ícone</Texto>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {ICONES_MODALIDADE.map((icone) => {
          const selecionado = icone === valor
          return (
            <Pressable
              key={icone}
              accessibilityRole="radio"
              accessibilityLabel={ROTULO_ICONE[icone]}
              accessibilityState={{ selected: selecionado }}
              onPress={() => aoMudar(icone)}
              className="h-12 w-12 items-center justify-center rounded-xl border-2 bg-superficie"
              style={{ borderColor: selecionado ? corPrimaria : paleta.borda }}
            >
              <ModalidadeIcone icone={icone} cor={selecionado ? corPrimaria : paleta.texto} />
            </Pressable>
          )
        })}
      </View>
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
    </View>
  )
}
