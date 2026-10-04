import Toast from 'react-native-toast-message'

// Os tipos são as chaves do `toastConfig`.
export const toast = {
  sucesso: (mensagem: string) => Toast.show({ type: 'sucesso', text1: mensagem }),
  erro: (mensagem: string) => Toast.show({ type: 'erro', text1: mensagem }),
  info: (mensagem: string) => Toast.show({ type: 'info', text1: mensagem }),
}
