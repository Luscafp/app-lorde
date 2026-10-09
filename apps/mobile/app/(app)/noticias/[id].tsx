import { useLocalSearchParams, useRouter } from 'expo-router'
import { TelaNoticia } from '@/features/noticias'

export default function Noticia() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TelaNoticia
      id={id}
      aoAbrirTag={(tag) =>
        router.push({ pathname: '/noticias', params: { tagId: tag.id, tag: tag.nome } })
      }
    />
  )
}
