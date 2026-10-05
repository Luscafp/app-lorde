import { Alert } from 'react-native'

export function confirmar({
  titulo,
  mensagem,
  acao = 'Confirmar',
  destrutiva = true,
  aoConfirmar,
}: {
  titulo: string
  mensagem: string
  acao?: string
  destrutiva?: boolean
  aoConfirmar: () => void
}) {
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: acao, style: destrutiva ? 'destructive' : 'default', onPress: aoConfirmar },
  ])
}
