import Toast from 'react-native-toast-message'

export type AcaoToast = { titulo: string; onPress: () => void }

function mostrar(type: string, mensagem: string, acao?: AcaoToast) {
  Toast.show(acao ? { type, text1: mensagem, props: { acao } } : { type, text1: mensagem })
}

// Os tipos são as chaves do `toastConfig`.
export const toast = {
  sucesso: (mensagem: string) => mostrar('sucesso', mensagem),
  erro: (mensagem: string, acao?: AcaoToast) => mostrar('erro', mensagem, acao),
  info: (mensagem: string) => mostrar('info', mensagem),
}
