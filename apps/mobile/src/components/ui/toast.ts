import Toast from 'react-native-toast-message'

/** `acao` aparece abaixo da mensagem; tocar no toast chama `aoTocar`. */
export type AcaoToast = { acao: string; aoTocar: () => void }

type VarianteToast = 'sucesso' | 'erro' | 'info'

function mostrar(type: VarianteToast, mensagem: string, acao?: AcaoToast) {
  if (!acao) return Toast.show({ type, text1: mensagem })
  Toast.show({
    type,
    text1: mensagem,
    text2: acao.acao,
    onPress: () => {
      Toast.hide()
      acao.aoTocar()
    },
  })
}

// Os tipos são as chaves do `toastConfig`.
export const toast = {
  sucesso: (mensagem: string, acao?: AcaoToast) => mostrar('sucesso', mensagem, acao),
  erro: (mensagem: string, acao?: AcaoToast) => mostrar('erro', mensagem, acao),
  info: (mensagem: string, acao?: AcaoToast) => mostrar('info', mensagem, acao),
}
