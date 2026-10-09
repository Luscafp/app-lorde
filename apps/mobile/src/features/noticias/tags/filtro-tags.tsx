import type { TagResumoDto } from '@atletica/shared'
import { Pilulas, type Opcao } from '@/components/ui'
import { useTags } from './consultas'

type Props = {
  tagId: string | undefined
  aoMudar: (tag: TagResumoDto | undefined) => void
  /** Painel: inclui tags usadas só em rascunhos. */
  incluirSemUso?: boolean
}

/** Uma tag por vez; oculto sem tags em uso. */
export function FiltroTags({ tagId, aoMudar, incluirSemUso = false }: Props) {
  const { data: tags = [] } = useTags({ emUso: !incluirSemUso })
  if (tags.length === 0) return null

  const opcoes: Opcao<string>[] = [
    { valor: undefined, rotulo: 'Todas' },
    ...tags.map(({ id, nome }) => ({ valor: id, rotulo: nome })),
  ]
  return (
    <Pilulas
      rotulo="Filtrar por tag"
      opcoes={opcoes}
      valor={tagId}
      aoMudar={(id) => aoMudar(tags.find((tag) => tag.id === id))}
    />
  )
}
