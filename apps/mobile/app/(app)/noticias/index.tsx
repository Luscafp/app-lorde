import { tagIdSchema } from '@atletica/shared'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ListaNoticias } from '@/features/noticias'

export default function Noticias() {
  const router = useRouter()
  const { tagId, tag } = useLocalSearchParams<{ tagId?: string; tag?: string }>()
  const tagValida = tagIdSchema.safeParse(tagId)
  const filtro = tagValida.success ? { id: tagValida.data, nome: tag } : undefined

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
