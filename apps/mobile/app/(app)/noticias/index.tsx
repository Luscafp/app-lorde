import { z } from 'zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ListaNoticias } from '@/features/noticias'

const uuid = z.uuid()

export default function Noticias() {
  const router = useRouter()
  const { tagId, tag } = useLocalSearchParams<{ tagId?: string; tag?: string }>()
  const filtro = uuid.safeParse(tagId).success && tagId ? { id: tagId, nome: tag } : undefined

  return (
    <ListaNoticias
      filtro={filtro}
      aoAbrir={(id) => router.push(`/noticias/${id}`)}
      aoFiltrar={(selecionada) =>
        router.setParams({ tagId: selecionada?.id, tag: selecionada?.nome })
      }
    />
  )
}
