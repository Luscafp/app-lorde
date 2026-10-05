import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { Pressable, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

type NomeIcone = ComponentProps<typeof Ionicons>['name']

export type PropsItemConfiguracao = {
  icone: NomeIcone
  rotulo: string
  onPress?: () => void
  valorDireita?: string
  desabilitado?: boolean
}

function ConteudoItem({
  icone,
  rotulo,
  valorDireita,
  tocavel,
}: PropsItemConfiguracao & { tocavel: boolean }) {
  return (
    <>
      <Ionicons name={icone} size={22} color={paleta['texto-suave']} />
      <Texto className="flex-1">{rotulo}</Texto>
      {valorDireita && <Texto variante="legenda">{valorDireita}</Texto>}
      {tocavel && <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />}
    </>
  )
}

const LINHA = 'min-h-[48px] flex-row items-center gap-3 px-4 py-3'

/** Sem `onPress` (ou desabilitado) vira linha informativa, fora da ordem de toque. */
export function ItemConfiguracao(props: PropsItemConfiguracao) {
  const { rotulo, onPress, desabilitado = false } = props
  if (!onPress || desabilitado) {
    return (
      <View accessible className={`${LINHA} ${desabilitado ? 'opacity-50' : ''}`}>
        <ConteudoItem {...props} tocavel={false} />
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      className={LINHA}
    >
      <ConteudoItem {...props} tocavel />
    </Pressable>
  )
}

export function SecaoConfiguracoes({
  titulo,
  itens,
}: {
  titulo: string
  itens: PropsItemConfiguracao[]
}) {
  return (
    <View className="gap-2">
      <Texto variante="legenda" accessibilityRole="header" className="px-1 uppercase">
        {titulo}
      </Texto>
      <View className="overflow-hidden rounded-2xl border border-borda bg-cartao">
        {itens.map((item, indice) => (
          <View key={item.rotulo} className={indice > 0 ? 'border-t border-borda' : ''}>
            <ItemConfiguracao {...item} />
          </View>
        ))}
      </View>
    </View>
  )
}
