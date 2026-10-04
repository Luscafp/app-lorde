import Toast from 'react-native-toast-message'

// Tipos do toastConfig padrão; a aparência própria é da #53.
export const toast = {
  sucesso: (mensagem: string) => Toast.show({ type: 'success', text1: mensagem }),
  erro: (mensagem: string) => Toast.show({ type: 'error', text1: mensagem }),
  info: (mensagem: string) => Toast.show({ type: 'info', text1: mensagem }),
}
