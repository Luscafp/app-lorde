import Toast from 'react-native-toast-message'

/** `rotulo` aparece abaixo da mensagem; tocar no toast chama `aoTocar`. */
export type AcaoToast = { rotulo: string; aoTocar: () => void }

// As variantes são as chaves do `toastConfig`.
export type VarianteToast = 'sucesso' | 'erro' | 'info'

function mostrar(variante: VarianteToast, mensagem: string, acao?: AcaoToast) {
  if (!acao) return Toast.show({ type: variante, text1: mensagem })
  Toast.show({
    type: variante,
    text1: mensagem,
    text2: acao.rotulo,
    onPress: () => {
      Toast.hide()
      acao.aoTocar()
    },
  })
}

const mostrarComo = (variante: VarianteToast) => (mensagem: string, acao?: AcaoToast) =>
  mostrar(variante, mensagem, acao)

export const toast = {
  sucesso: mostrarComo('sucesso'),
  erro: mostrarComo('erro'),
  info: mostrarComo('info'),
}
