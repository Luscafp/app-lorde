import type { TagResumoDto } from '@atletica/shared'
import { View } from 'react-native'
import { Texto } from '@/components/ui'
import { ChipTag } from './chip-tag'

type Props = {
  tags: readonly TagResumoDto[]
  /** Acima dele, um indicador "+N". */
  maximo?: number
  aoPressionar?: (tag: TagResumoDto) => void
}

export function ListaTags({ tags, maximo = tags.length, aoPressionar }: Props) {
  if (tags.length === 0) return null
  const visiveis = tags.slice(0, maximo)
  const restantes = tags.length - visiveis.length
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {visiveis.map((tag) => (
        <ChipTag
          key={tag.id}
          nome={tag.nome}
          aoPressionar={aoPressionar && (() => aoPressionar(tag))}
        />
      ))}
      {restantes > 0 && <Texto variante="legenda">{`+${restantes}`}</Texto>}
    </View>
  )
}
