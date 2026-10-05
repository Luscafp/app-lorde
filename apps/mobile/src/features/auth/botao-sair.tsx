import { Alert } from 'react-native'
import { Botao } from '@/components/ui'
import { useLogout } from './use-logout'

function confirmar(aoConfirmar: () => void) {
  Alert.alert('Sair da conta', 'Deseja encerrar a sessão neste dispositivo?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Sair', style: 'destructive', onPress: aoConfirmar },
  ])
}

export function BotaoSair() {
  const { sair, saindo } = useLogout()

  return (
    <Botao titulo="Sair" variante="perigo" carregando={saindo} onPress={() => confirmar(sair)} />
  )
}
