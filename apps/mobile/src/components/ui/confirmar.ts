import { Alert } from 'react-native'

export function confirmar({
  titulo,
  mensagem,
  acao = 'Confirmar',
  cancelar = 'Cancelar',
  destrutiva = true,
  aoConfirmar,
}: {
  titulo: string
  mensagem: string
  acao?: string
  cancelar?: string
  destrutiva?: boolean
  aoConfirmar: () => void
}) {
  Alert.alert(titulo, mensagem, [
    { text: cancelar, style: 'cancel' },
    { text: acao, style: destrutiva ? 'destructive' : 'default', onPress: aoConfirmar },
  ])
}
