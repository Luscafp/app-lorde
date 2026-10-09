import { Linking, View } from 'react-native'
import { Alerta, Botao } from '@/components/ui'
import type { Permissao } from '../permissao'

export const MENSAGEM_PERMISSAO_NEGADA =
  'As notificações estão bloqueadas nas configurações do Android.'

type Props = { permissao: Permissao | undefined; aoPermitir: () => void }

export function AvisoPermissao({ permissao, aoPermitir }: Props) {
  if (permissao === 'negada') {
    return (
      <View className="gap-3">
        <Alerta variante="alerta">{MENSAGEM_PERMISSAO_NEGADA}</Alerta>
        <Botao
          titulo="Abrir configurações"
          variante="secundaria"
          onPress={() => void Linking.openSettings()}
        />
      </View>
    )
  }
  if (permissao === 'nao-perguntada') {
    return <Botao titulo="Permitir notificações" onPress={aoPermitir} />
  }
  return null
}
