import { ActivityIndicator } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

export function EstadoOpcoes({
  carregando,
  falhou,
  mensagemErro,
}: {
  carregando: boolean
  falhou: boolean
  mensagemErro: string
}) {
  if (falhou) return <Texto variante="legenda">{mensagemErro}</Texto>
  if (carregando) return <ActivityIndicator color={paleta['texto-suave']} />
  return null
}
